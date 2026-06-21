import { useEffect, useState, useCallback } from 'react';
import { getAppointments, rescheduleAppointment } from '@/services/appointmentService';
import { getActiveTechnicians } from '@/services/technicianService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppointmentStatusBadge } from '@/components/shared/AppointmentStatusBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, startOfDay, addDays } from 'date-fns';
import type { Appointment, User } from '@/types/database';
import { toast } from 'sonner';

export function DispatchBoard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null);

  const load = useCallback(async () => {
    try {
      const today = startOfDay(new Date());
      const [appts, techs] = await Promise.all([
        getAppointments({
          start_date: today.toISOString(),
          end_date: addDays(today, 7).toISOString(),
        }),
        getActiveTechnicians(),
      ]);
      setAppointments(appts);
      setTechnicians(techs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDragStart = (apt: Appointment) => {
    setDraggedAppointment(apt);
  };

  const handleDrop = async (technicianId: string) => {
    if (!draggedAppointment || draggedAppointment.technician_id === technicianId) {
      setDraggedAppointment(null);
      return;
    }

    try {
      await rescheduleAppointment(
        draggedAppointment.id,
        draggedAppointment.start_time,
        draggedAppointment.end_time,
        technicianId,
      );
      toast.success('Appointment reassigned');
      load();
    } catch {
      toast.error('Failed to reassign');
    }
    setDraggedAppointment(null);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dispatch Board</h1>
      <p className="text-sm text-muted-foreground">
        Drag and drop appointments between technicians to reassign
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {technicians.map((tech) => {
          const techAppts = appointments.filter((a) => a.technician_id === tech.id);
          return (
            <Card
              key={tech.id}
              className="min-h-[400px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(tech.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {tech.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <CardTitle className="text-sm">{tech.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {techAppts.length} appointments
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {techAppts.map((apt) => (
                      <div
                        key={apt.id}
                        draggable
                        onDragStart={() => handleDragStart(apt)}
                        className="p-3 rounded-lg border cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow bg-white"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-xs">
                            {apt.customer?.first_name} {apt.customer?.last_name}
                          </p>
                          <AppointmentStatusBadge status={apt.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(apt.start_time), 'EEE, MMM d')}
                        </p>
                        <p className="text-xs text-primary font-medium">
                          {format(new Date(apt.start_time), 'h:mm a')} -{' '}
                          {format(new Date(apt.end_time), 'h:mm a')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                          {apt.appointment_type}
                        </p>
                      </div>
                    ))}
                    {techAppts.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No appointments
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}

        {/* Unassigned column */}
        <Card className="min-h-[400px] border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Unassigned</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[350px]">
              <div className="space-y-2">
                {appointments
                  .filter((a) => !a.technician_id)
                  .map((apt) => (
                    <div key={apt.id} className="p-3 rounded-lg border bg-yellow-50">
                      <p className="font-medium text-xs">
                        {apt.customer?.first_name} {apt.customer?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(apt.start_time), 'EEE h:mm a')}
                      </p>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
