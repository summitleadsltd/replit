import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, MapPin, User, Search, Wrench, Navigation } from "lucide-react";
import { format, isToday, isTomorrow, isThisWeek } from "date-fns";
import { toESTDate } from "@/lib/timezone";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

interface Appointment {
  id: string;
  appointment_at: string;
  status: string | null;
  confirmation_status?: string | null;
  visit_status?: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  contact_id: string;
  agent_id: string | null;
  campaign_id: string | null;
  technician_id?: string | null;
  contacts?: { first_name: string; last_name: string; phone_e164: string | null } | null;
  campaigns?: { name: string } | null;
  source?: "sales" | "technician";
  technician_name?: string | null;
  end_at?: string | null;
}

const statusColor: Record<string, string> = {
  booked: "bg-primary/15 text-primary border-primary/30",
  confirmed: "bg-green-500/15 text-green-400 border-green-500/30",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  rescheduled: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  no_show: "bg-destructive/15 text-destructive border-destructive/30",
  replaced: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-primary/15 text-primary border-primary/30",
  en_route: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  on_site: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  unable_to_reach: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export default function Appointments() {
  const { isAdmin, isConfirmer, canManageAllCalendars } = useAuth();
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("upcoming");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([]);
  const [rescheduling, setRescheduling] = useState<string | null>(null);

  useEffect(() => {
    loadAppointments();
    if (canManageAllCalendars) {
      loadTechnicians();
    }
  }, [canManageAllCalendars]);

  async function loadTechnicians() {
    const { data, error } = await supabase
      .from("technicians")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (error) {
      if (import.meta.env.DEV) console.error("[Appointments] loadTechnicians error:", error.message);
      toast({ title: "Error loading technicians", description: error.message, variant: "destructive" });
      setTechnicians([]);
      return;
    }
    setTechnicians(data ?? []);
  }

  async function loadAppointments() {
    setLoading(true);
    const [salesRes, techRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, contacts(first_name,last_name,phone_e164), campaigns(name), technician:technicians(id, name)")
        .order("appointment_at", { ascending: true }),
      supabase
        .from("technician_appointments")
        .select(
          "id, technician_id, contact_id, campaign_id, lead_address, start_time, end_time, status, notes, technicians(name)"
        )
        .order("start_time", { ascending: true }),
    ]);
    const sales: Appointment[] = ((salesRes.data as unknown as Appointment[]) ?? []).map(
      (a: any) => ({ ...a, source: "sales", technician_name: a.technician?.name ?? null }),
    );
    const techRows = (techRes.data as unknown as Array<{
      id: string; technician_id: string; contact_id: string | null; campaign_id: string | null;
      lead_address: string | null; start_time: string; end_time: string; status: string;
      notes: string | null;
      technicians?: { name: string } | null;
    }>) ?? [];

    const contactIds = Array.from(new Set(techRows.map((t) => t.contact_id).filter(Boolean) as string[]));
    const campaignIds = Array.from(new Set(techRows.map((t) => t.campaign_id).filter(Boolean) as string[]));
    const [contactsRes, campaignsRes] = await Promise.all([
      contactIds.length
        ? supabase.from("contacts").select("id, first_name, last_name, phone_e164").in("id", contactIds)
        : Promise.resolve({ data: [] as Array<{ id: string; first_name: string; last_name: string; phone_e164: string | null }> }),
      campaignIds.length
        ? supabase.from("campaigns").select("id, name").in("id", campaignIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);
    const contactMap = new Map((contactsRes.data ?? []).map((c) => [c.id, c]));
    const campaignMap = new Map((campaignsRes.data ?? []).map((c) => [c.id, c]));

    const tech: Appointment[] = techRows.map((t) => ({
      id: t.id,
      appointment_at: t.start_time,
      end_at: t.end_time,
      status: t.status,
      address: t.lead_address,
      city: null, state: null, zip_code: null,
      notes: t.notes,
      contact_id: t.contact_id ?? "",
      agent_id: null,
      campaign_id: t.campaign_id,
      contacts: t.contact_id
        ? (contactMap.get(t.contact_id) as { first_name: string; last_name: string; phone_e164: string | null } | undefined) ?? null
        : null,
      campaigns: t.campaign_id ? campaignMap.get(t.campaign_id) ?? null : null,
      source: "technician",
      technician_name: t.technicians?.name ?? null,
    }));
    const combined = [...sales, ...tech].sort(
      (a, b) => new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime(),
    );
    setItems(combined);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const item = items.find((i) => i.id === id);
    if (item?.source === "technician") {
      await supabase
        .from("technician_appointments")
        .update({ status: status as never })
        .eq("id", id);
    } else {
      await supabase.from("appointments").update({ status: status as never }).eq("id", id);
    }
    loadAppointments();
  }

  async function rescheduleAppointment(id: string) {
    const newTime = prompt("New date/time (YYYY-MM-DD HH:MM):");
    if (!newTime) return;
    // Normalize input to ISO-like string with seconds
    const normalized = newTime.replace(" ", "T") + ":00";
    const parsedDate = new Date(normalized);
    if (isNaN(parsedDate.getTime())) {
      toast({ title: "Invalid date", description: "Please use YYYY-MM-DD HH:MM", variant: "destructive" });
      return;
    }
    const iso = parsedDate.toISOString();
    setRescheduling(id);
    try {
      const item = items.find((i) => i.id === id);
      if (item?.source === "technician") {
        const originalDuration = item.end_at
          ? new Date(item.end_at).getTime() - new Date(item.appointment_at).getTime()
          : 0;
        const endAt = originalDuration > 0
          ? new Date(parsedDate.getTime() + originalDuration).toISOString()
          : null;
        const { error } = await supabase
          .from("technician_appointments")
          .update({ start_time: iso, end_time: endAt, status: "rescheduled" as never })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("appointments")
          .update({ appointment_at: iso, confirmation_status: "rescheduled" as any, confirmation_attempted_at: new Date().toISOString() } as any)
          .eq("id", id);
        if (error) throw error;
      }
      loadAppointments();
    } catch (err: any) {
      if (import.meta.env.DEV) console.error("[Appointments] reschedule error:", err);
      toast({ title: "Reschedule failed", description: err.message || "Could not reschedule", variant: "destructive" });
    } finally {
      setRescheduling(null);
    }
  }

  function openNavigation(appointment: Appointment) {
    const address = [appointment.address, appointment.city, appointment.state, appointment.zip_code]
      .filter(Boolean)
      .join(", ");
    
    if (!address) {
      toast({ title: "No address", description: "This appointment has no address", variant: "destructive" });
      return;
    }

    // Detect if mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Use native navigation on mobile
      const isAndroid = /Android/i.test(navigator.userAgent);
      if (isAndroid) {
        // Android: Use google.navigation scheme
        window.location.href = `google.navigation:q=${encodeURIComponent(address)}`;
      } else {
        // iOS: Use maps.google.com with daddr parameter
        window.location.href = `https://maps.google.com/?daddr=${encodeURIComponent(address)}`;
      }
    } else {
      // Desktop: Open Google Maps in new tab
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    }
  }

  const filtered = useMemo(() => {
    const now = new Date();
    return items.filter((a) => {
      const at = new Date(a.appointment_at);
      if (rangeFilter === "today" && !isToday(at)) return false;
      if (rangeFilter === "tomorrow" && !isTomorrow(at)) return false;
      if (rangeFilter === "week" && !isThisWeek(at, { weekStartsOn: 1 })) return false;
      if (rangeFilter === "upcoming" && at < now) return false;
      if (rangeFilter === "past" && at >= now) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (technicianFilter !== "all" && a.technician_id !== technicianFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = `${a.contacts?.first_name ?? ""} ${a.contacts?.last_name ?? ""}`.toLowerCase();
        const loc = `${a.address ?? ""} ${a.city ?? ""} ${a.zip_code ?? ""}`.toLowerCase();
        if (!name.includes(q) && !loc.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter, rangeFilter, technicianFilter]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    filtered.forEach((a) => {
      const key = format(toESTDate(a.appointment_at), "EEEE, MMM d, yyyy");
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "appointment" : "appointments"}
          </p>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={rangeFilter} onValueChange={setRangeFilter}>
          <SelectTrigger className="w-full md:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="tomorrow">Tomorrow</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="past">Past</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rescheduled">Rescheduled</SelectItem>
            <SelectItem value="no_show">No-show</SelectItem>
            <SelectItem value="scheduled">Scheduled (tech)</SelectItem>
            <SelectItem value="en_route">En route</SelectItem>
            <SelectItem value="on_site">On site</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="unable_to_reach">Unable to reach</SelectItem>
          </SelectContent>
        </Select>
        {canManageAllCalendars && (
          <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
            <SelectTrigger className="w-full md:w-[160px]">
              <SelectValue placeholder="All technicians" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All technicians</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : grouped.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarClock className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No appointments match your filters.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, list]) => (
            <div key={day}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {day}
              </h2>
              <div className="space-y-2">
                {list.map((a) => (
                  <Card key={a.id} className="p-4 hover:border-primary/40 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex items-center gap-3 md:w-32 shrink-0">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex flex-col items-center justify-center">
                          <span className="text-xs text-muted-foreground leading-none">
                            {format(toESTDate(a.appointment_at), "MMM").toUpperCase()}
                          </span>
                          <span className="text-lg font-bold text-primary leading-none mt-0.5">
                            {format(toESTDate(a.appointment_at), "d")}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold">
                            {format(toESTDate(a.appointment_at), "h:mm a")}
                          </div>
                          <Badge
                            variant="outline"
                            className={statusColor[a.status ?? "booked"] ?? ""}
                          >
                            {a.status ?? "booked"}
                          </Badge>
                          {a.source === "sales" && a.confirmation_status && a.confirmation_status !== "scheduled" && (
                            <Badge variant="outline" className="text-[10px] mt-1 ml-1">
                              {a.confirmation_status}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {a.source === "technician" ? (
                            <Wrench className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <User className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">
                            {a.contacts?.first_name} {a.contacts?.last_name}
                          </span>
                          {a.contacts?.phone_e164 && (
                            <span className="text-xs text-muted-foreground">
                              {a.contacts.phone_e164}
                            </span>
                          )}
                          {a.source === "technician" && (
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              Tech
                            </Badge>
                          )}
                        </div>
                        {a.source === "technician" && a.technician_name && (
                          <div className="text-xs text-muted-foreground">
                            Technician: {a.technician_name}
                            {a.end_at && (
                              <span> · ends {format(toESTDate(a.end_at), "h:mm a")}</span>
                            )}
                          </div>
                        )}
                        {(a.address || a.city) && (
                          <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>
                              {[a.address, a.city, a.state, a.zip_code]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </div>
                        )}
                        {a.campaigns?.name && (
                          <div className="text-xs text-muted-foreground">
                            Campaign: {a.campaigns.name}
                          </div>
                        )}
                        {a.notes && (
                          <p className="text-sm text-foreground/80 mt-1 line-clamp-2">
                            {a.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {(a.address || a.city) && (
                          <Button size="sm" variant="outline" onClick={() => openNavigation(a)}>
                            <Navigation className="w-4 h-4 mr-1" />
                            Navigate
                          </Button>
                        )}
                        {a.status === "booked" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(a.id, "confirmed")}>
                            Confirm
                          </Button>
                        )}
                        {a.status !== "completed" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(a.id, "completed")}>
                            Complete
                          </Button>
                        )}
                        {isAdmin && a.status !== "no_show" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(a.id, "no_show")}>
                            No-show
                          </Button>
                        )}
                        {(isConfirmer || isAdmin) && (
                          <Button size="sm" variant="outline" onClick={() => rescheduleAppointment(a.id)} disabled={rescheduling === a.id}>
                            {rescheduling === a.id ? "Rescheduling..." : "Reschedule"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}