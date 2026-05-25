import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { toESTDate } from "@/lib/timezone";
import { ChevronLeft, ChevronRight, Calendar, Clock, User, AlertCircle } from "lucide-react";

type CalendarView = "day" | "week" | "month";

interface Technician {
  id: string;
  name: string;
  user_id: string | null;
}

interface CalendarAppointment {
  id: string;
  appointment_at: string;
  duration_minutes: number;
  confirmation_status: string;
  contact: {
    first_name: string;
    last_name: string;
    address: string | null;
    city: string | null;
  };
}

interface TechnicianCalendarProps {
  selectedTechnicianId?: string;
  onTechnicianChange?: (technicianId: string) => void;
  onSlotSelect?: (date: Date, conflicts: CalendarAppointment[]) => void;
  readOnly?: boolean;
}

export function TechnicianCalendar({
  selectedTechnicianId,
  onTechnicianChange,
  onSlotSelect,
  readOnly = false,
}: TechnicianCalendarProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<CalendarAppointment[]>([]);

  // Fetch technicians
  useEffect(() => {
    const fetchTechnicians = async () => {
      const { data } = await supabase
        .from("technicians")
        .select("id, name, user_id")
        .order("name");
      setTechnicians(data || []);
    };
    fetchTechnicians();
  }, []);

  // Fetch appointments for selected technician
  useEffect(() => {
    if (!selectedTechnicianId) return;

    const fetchAppointments = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_at,
          duration_minutes,
          confirmation_status,
          contacts!inner(first_name, last_name, address, city)
        `)
        .eq("technician_id", selectedTechnicianId)
        .gte("appointment_at", startOfWeek(currentDate).toISOString())
        .lte("appointment_at", endOfWeek(currentDate).toISOString())
        .order("appointment_at", { ascending: true });

      const mapped: CalendarAppointment[] = (data || []).map((a: any) => ({
        id: a.id,
        appointment_at: a.appointment_at,
        duration_minutes: a.duration_minutes || 60,
        confirmation_status: a.confirmation_status,
        contact: {
          first_name: a.contacts?.first_name || "",
          last_name: a.contacts?.last_name || "",
          address: a.contacts?.address || null,
          city: a.contacts?.city || null,
        },
      }));

      setAppointments(mapped);
      setLoading(false);
    };

    fetchAppointments();
  }, [selectedTechnicianId, currentDate]);

  // Check for conflicts when proposing a slot
  const checkConflict = async (date: Date, durationMinutes: number = 60) => {
    if (!selectedTechnicianId) return [];

    const { data } = await supabase.rpc("check_technician_availability", {
      p_technician_id: selectedTechnicianId,
      p_scheduled_at: date.toISOString(),
      p_duration_minutes: durationMinutes,
    });

    if (data && !data[0]?.is_available) {
      // Find conflicting appointments in current range
      const proposedStart = date.getTime();
      const proposedEnd = proposedStart + durationMinutes * 60000;

      return appointments.filter((appt) => {
        const apptStart = new Date(appt.appointment_at).getTime();
        const apptEnd = apptStart + appt.duration_minutes * 60000;
        return apptStart < proposedEnd && apptEnd > proposedStart;
      });
    }

    return [];
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

  const navigatePrevious = () => {
    if (view === "day") setCurrentDate(addDays(currentDate, -1));
    else if (view === "week") setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const navigateNext = () => {
    if (view === "day") setCurrentDate(addDays(currentDate, 1));
    else if (view === "week") setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate),
    end: endOfWeek(currentDate),
  });

  const renderDayView = () => {
    const dayAppointments = appointments.filter((a) =>
      isSameDay(new Date(a.appointment_at), currentDate)
    );

    return (
      <div className="space-y-2">
        {dayAppointments.map((appt) => (
          <div
            key={appt.id}
            className="p-3 border rounded-md hover:bg-muted/50 cursor-pointer"
            onClick={() => onSlotSelect?.(new Date(appt.appointment_at), [])}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">
                  {format(toESTDate(appt.appointment_at), "h:mm a")}
                </span>
                <span className="text-muted-foreground">
                  ({appt.duration_minutes} min)
                </span>
              </div>
              <Badge className={getStatusColor(appt.confirmation_status)}>
                {appt.confirmation_status}
              </Badge>
            </div>
            <p className="mt-1 font-medium">
              {appt.contact.first_name} {appt.contact.last_name}
            </p>
            <p className="text-sm text-muted-foreground">
              {appt.contact.address}, {appt.contact.city}
            </p>
          </div>
        ))}
        {dayAppointments.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No appointments</p>
        )}
      </div>
    );
  };

  const renderWeekView = () => {
    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dayApps = appointments.filter((a) =>
            isSameDay(new Date(a.appointment_at), day)
          );

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[150px] p-2 border rounded-md ${
                isSameDay(day, new Date()) ? "border-primary bg-primary/5" : ""
              }`}
            >
              <p className="text-sm font-medium text-center mb-2">
                {format(day, "EEE")}
                <br />
                {format(day, "d")}
              </p>
              <div className="space-y-1">
                {dayApps.slice(0, 3).map((appt) => (
                  <div
                    key={appt.id}
                    className={`text-xs p-1 rounded cursor-pointer ${getStatusColor(appt.confirmation_status)}`}
                    onClick={() => onSlotSelect?.(new Date(appt.appointment_at), [])}
                  >
                    {format(toESTDate(appt.appointment_at), "h:mm a")} - {appt.contact.last_name}
                  </div>
                ))}
                {dayApps.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{dayApps.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Technician Calendar
          </CardTitle>

          <div className="flex items-center gap-2">
            <Select value={view} onValueChange={(v) => setView(v as CalendarView)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={navigatePrevious}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {view === "day" && format(currentDate, "MMMM d, yyyy")}
              {view === "week" && `${format(weekDays[0], "MMM d")} - ${format(weekDays[6], "MMM d")}`}
              {view === "month" && format(currentDate, "MMMM yyyy")}
            </span>
            <Button variant="outline" size="icon" onClick={navigateNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 mt-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <Select
              value={selectedTechnicianId || ""}
              onValueChange={onTechnicianChange}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <>
            {conflicts.length > 0 && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">Schedule Conflict Detected</span>
                </div>
                <p className="text-sm mt-1">
                  The selected time overlaps with {conflicts.length} existing appointment(s).
                </p>
                <div className="mt-2 space-y-1">
                  {conflicts.map((c) => (
                    <p key={c.id} className="text-sm">
                      • {format(toESTDate(c.appointment_at), "h:mm a")} - {c.contact.first_name} {c.contact.last_name}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {view === "day" && renderDayView()}
            {view === "week" && renderWeekView()}
            {view === "month" && <div className="text-center py-8 text-muted-foreground">Month view - Use Day or Week for details</div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
