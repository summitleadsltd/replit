import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { toESTDate } from "@/lib/timezone";
import { Phone, Calendar, User, CheckCircle, XCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmationAppointment {
  id: string;
  contact_id: string;
  appointment_at: string;
  technician_id: string | null;
  agent_id: string | null;
  confirmation_status: "pending" | "confirmed" | "failed_to_reach" | "rescheduled" | "cancelled";
  language: string;
  notes: string | null;
  contact: {
    first_name: string;
    last_name: string;
    phone_e164: string | null;
    language: string;
  };
  technician: {
    name: string;
  } | null;
  agent: {
    display_name: string | null;
    email: string;
  } | null;
  last_call_attempt: {
    id: string;
    notes: string | null;
  } | null;
}

export default function Confirmations() {
  const { user, profile, isAdmin, isAgent } = useAuth();
  const [appointments, setAppointments] = useState<ConfirmationAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgentId, setFilterAgentId] = useState<string>("all");
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [groupedByAgent, setGroupedByAgent] = useState<Record<string, ConfirmationAppointment[]>>({});

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const fetchConfirmations = useCallback(async () => {
    setLoading(true);
    try {
      // Get appointments for tomorrow
      const startOfDay = `${tomorrowStr}T00:00:00`;
      const endOfDay = `${tomorrowStr}T23:59:59`;

      let query = supabase
        .from("appointments")
        .select(`
          id,
          contact_id,
          appointment_at,
          technician_id,
          agent_id,
          confirmation_status,
          notes,
          contacts!inner(id, first_name, last_name, phone_e164, language),
          technicians:technician_id(id, name),
          profiles:agent_id(display_name, email)
        `)
        .gte("appointment_at", startOfDay)
        .lte("appointment_at", endOfDay)
        .order("appointment_at", { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      // Map to our interface (handle the nested structure)
      const mapped: ConfirmationAppointment[] = (data || []).map((a: any) => ({
        id: a.id,
        contact_id: a.contact_id,
        appointment_at: a.appointment_at,
        technician_id: a.technician_id,
        agent_id: a.agent_id,
        confirmation_status: a.confirmation_status,
        notes: a.notes,
        language: a.contacts?.language || "en",
        contact: {
          first_name: a.contacts?.first_name || "",
          last_name: a.contacts?.last_name || "",
          phone_e164: a.contacts?.phone_e164 || null,
          language: a.contacts?.language || "en",
        },
        technician: a.technicians ? { name: a.technicians.name } : null,
        agent: a.profiles ? { display_name: a.profiles.display_name, email: a.profiles.email } : null,
        last_call_attempt: a.call_attempts?.[0] ? { id: a.call_attempts[0].id, notes: a.call_attempts[0].notes } : null,
      }));

      setAppointments(mapped);

      // Group by booking agent
      const grouped: Record<string, ConfirmationAppointment[]> = {};
      mapped.forEach((appt) => {
        const agentKey = appt.agent_id || "unassigned";
        if (!grouped[agentKey]) grouped[agentKey] = [];
        grouped[agentKey].push(appt);
      });
      setGroupedByAgent(grouped);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[Confirmations] Fetch error:", err);
      toast({ title: "Error loading confirmations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tomorrowStr]);

  useEffect(() => {
    fetchConfirmations();
  }, [fetchConfirmations]);

  const updateConfirmationStatus = async (
    appointmentId: string,
    status: ConfirmationAppointment["confirmation_status"],
    callAttemptId?: string
  ) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          confirmation_status: status,
          confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
          confirmed_by_agent_id: user?.id,
        })
        .eq("id", appointmentId);

      if (error) throw error;

      // Log to call_attempts if a call was placed
      if (callAttemptId) {
        await supabase.from("call_attempts").update({
          notes: `Confirmation call: ${status}`,
        }).eq("id", callAttemptId);
      }

      toast({ title: `Status updated to ${status}` });
      fetchConfirmations();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[Confirmations] Update error:", err);
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const initiateConfirmationCall = (appointment: ConfirmationAppointment) => {
    // Navigate to dialer with this contact pre-selected
    // For now, open dialer in new tab or navigate
    // This would integrate with the dialer component
    toast({
      title: "Opening dialer",
      description: `Calling ${appointment.contact.first_name} ${appointment.contact.last_name}`,
    });

    // Store the target contact in session storage for the dialer to pick up
    sessionStorage.setItem("confirmation_call_target", JSON.stringify({
      contact_id: appointment.contact_id,
      phone: appointment.contact.phone_e164,
      appointment_id: appointment.id,
      language: appointment.language,
    }));

    // Navigate to dialer
    window.location.href = "/dialer";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-success text-success-foreground";
      case "pending": return "bg-warning text-warning-foreground";
      case "failed_to_reach": return "bg-destructive/80 text-destructive-foreground";
      case "rescheduled": return "bg-info text-info-foreground";
      case "cancelled": return "bg-muted text-muted-foreground";
      default: return "bg-secondary";
    }
  };

  const filteredAppointments = appointments.filter((appt) => {
    if (filterAgentId !== "all" && appt.agent_id !== filterAgentId) return false;
    if (filterLanguage !== "all" && appt.language !== filterLanguage) return false;
    return true;
  });

  // Get unique agents for filter
  const uniqueAgents = Array.from(new Set(appointments.map((a) => a.agent_id).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-slide-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-header-title">Day-Prior Confirmations</h1>
          <p className="page-header-subtitle">
            Appointments scheduled for {format(toESTDate(tomorrow), "MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{filteredAppointments.length} appointments</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <Select value={filterAgentId} onValueChange={setFilterAgentId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {uniqueAgents.map((agentId) => {
              const agent = appointments.find((a) => a.agent_id === agentId)?.agent;
              return (
                <SelectItem key={agentId} value={agentId || "unknown"}>
                  {agent?.display_name || agent?.email || "Unknown"}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Select value={filterLanguage} onValueChange={setFilterLanguage}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Languages</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={fetchConfirmations}>
          Refresh
        </Button>
      </div>

      {/* Supervisor Alert */}
      {isAdmin && (
        <div className="mb-6 p-4 bg-muted rounded-md">
          <h4 className="font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Supervisor Alert
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            Pending confirmations not completed by 6:00 PM today will trigger a notification.
          </p>
        </div>
      )}

      {/* Appointments List - Grouped by Agent */}
      <div className="space-y-6">
        {Object.entries(groupedByAgent).map(([agentId, agentAppointments]) => {
          // Apply filters
          const filtered = agentAppointments.filter((appt) => {
            if (filterAgentId !== "all" && appt.agent_id !== filterAgentId) return false;
            if (filterLanguage !== "all" && appt.language !== filterLanguage) return false;
            return true;
          });

          if (filtered.length === 0) return null;

          const agent = filtered[0]?.agent;

          return (
            <Card key={agentId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {agent?.display_name || agent?.email || "Unassigned"}
                  <Badge variant="outline" className="ml-2">
                    {filtered.length} appointments
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filtered.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {appt.contact.first_name} {appt.contact.last_name}
                          </span>
                          <Badge className={getStatusColor(appt.confirmation_status)}>
                            {appt.confirmation_status}
                          </Badge>
                          {appt.language === "es" && (
                            <Badge variant="outline">ES</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(toESTDate(appt.appointment_at), "h:mm a")}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {appt.technician?.name || "No technician"}
                          </span>
                          {appt.last_call_attempt?.notes && (
                            <span className="truncate max-w-xs">
                              Last call: {appt.last_call_attempt.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {appt.contact.phone_e164 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => initiateConfirmationCall(appt)}
                          >
                            <Phone className="w-4 h-4 mr-1" />
                            Call
                          </Button>
                        )}

                        <Select
                          value={appt.confirmation_status}
                          onValueChange={(val) => updateConfirmationStatus(appt.id, val as any)}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="rescheduled">Rescheduled</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="failed_to_reach">No Answer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredAppointments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No appointments found for tomorrow</p>
          </div>
        )}
      </div>
    </div>
  );
}
