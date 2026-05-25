import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { format, addDays, startOfDay } from "date-fns";
import { toESTDate } from "@/lib/timezone";
import { Calendar, Phone, X, Check, Clock, CalendarClock } from "lucide-react";

type Appt = {
  id: string;
  contact_id: string;
  appointment_at: string;
  address: string | null;
  notes: string | null;
  confirmation_status: string;
  status: string;
  technician_id: string;
  technician: { id: string; name: string; user_id: string } | null;
  contact: { first_name: string; last_name: string; phone_e164: string };
};

export default function ConfirmerQueue() {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // FIX 14: Load only tomorrow's appointments (D-1 queue)
      const tomorrow = addDays(new Date(), 1);
      const tomorrowStartDate = startOfDay(tomorrow);
      const tomorrowStart = tomorrowStartDate.toISOString();
      const tomorrowEnd = addDays(tomorrowStartDate, 1).toISOString();

      const { data, error } = await supabase
        .from("appointments")
        .select("id, contact_id, appointment_at, address, notes, confirmation_status, status, technician_id, technician:technicians(id, name, user_id), contact:contacts(first_name, last_name, phone_e164)")
        .gte("appointment_at", tomorrowStart)
        .lt("appointment_at", tomorrowEnd)
        .order("appointment_at", { ascending: true });

      if (error) {
        if (import.meta.env.DEV) console.error("[ConfirmerQueue] load error:", error.message);
        toast({ title: "Error loading appointments", description: error.message, variant: "destructive" });
        return;
      }
      if (data) {
        setAppts(data as unknown as Appt[]);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error("[ConfirmerQueue] load unexpected error:", err);
      toast({ title: "Error loading appointments", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      scheduled: "bg-warning/10 text-warning",
      confirmed: "bg-success/10 text-success",
      no_show: "bg-destructive/10 text-destructive",
      rescheduled: "bg-info/10 text-info",
      cancelled: "bg-muted text-muted-foreground",
      unable_to_reach: "bg-amber-500/10 text-amber-500",
      no_answer: "bg-amber-500/10 text-amber-500",
    };
    return map[s] || "";
  };

  // FIX 13 & 14: Implement Confirmer appointment confirmation workflow
  const updateStatus = async (apptId: string, newStatus: string, notes?: string) => {
    setUpdatingId(apptId);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ 
          confirmation_status: newStatus,
          notes: notes || null
        })
        .eq("id", apptId);

      if (error) throw error;

      toast({ title: "Status updated", description: `Appointment marked as ${newStatus}` });
      await load(); // Refresh list
    } catch (err) {
      if (import.meta.env.DEV) console.error("[ConfirmerQueue] update error:", err);
      toast({ title: "Error updating status", description: "Failed to update appointment status", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmAppointment = async (apptId: string) => {
    await updateStatus(apptId, "confirmed");
  };

  const markNoAnswer = async (apptId: string) => {
    await updateStatus(apptId, "no_answer", "Unable to reach customer");
  };

  const cancelAppointment = async (apptId: string) => {
    await updateStatus(apptId, "cancelled", "Customer cancelled");
  };

  if (loading) return <div className="p-6">Loading appointments…</div>;

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold">Confirmer Queue - Tomorrow's Appointments</h1>
        <p className="text-muted-foreground text-sm mt-1">Confirm appointments scheduled for tomorrow ({format(addDays(new Date(), 1), "MMM d, yyyy")})</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            Tomorrow's Appointments ({appts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appts.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No appointments scheduled for tomorrow</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[700px] overflow-y-auto">
              {appts.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{appt.contact.first_name} {appt.contact.last_name}</p>
                      <Badge variant="secondary" className={statusColor(appt.confirmation_status)}>
                        {appt.confirmation_status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(toESTDate(appt.appointment_at), "MMM d, yyyy h:mm a")}
                    </p>
                    <p className="text-sm text-muted-foreground">{appt.contact.phone_e164}</p>
                    {(appt.address) && (
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        {appt.address}
                      </p>
                    )}
                    {appt.technician && (
                      <p className="text-sm text-muted-foreground/70">
                        Technician: {appt.technician.name}
                      </p>
                    )}
                    {appt.notes && (
                      <p className="text-xs text-muted-foreground mt-2 bg-background p-2 rounded">
                        {appt.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => confirmAppointment(appt.id)}
                      disabled={updatingId === appt.id || appt.confirmation_status === "confirmed"}
                      className="gap-1"
                    >
                      <Check className="w-4 h-4" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markNoAnswer(appt.id)}
                      disabled={updatingId === appt.id}
                      className="gap-1"
                    >
                      <Clock className="w-4 h-4" />
                      No Answer
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancelAppointment(appt.id)}
                      disabled={updatingId === appt.id || appt.confirmation_status === "cancelled"}
                      className="gap-1"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
