import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getAppointments } from '@/services/appointmentService';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import type { EventInput, EventClickArg } from '@fullcalendar/core';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppointmentStatusBadge } from '@/components/shared/AppointmentStatusBadge';
import { format } from 'date-fns';
import type { Appointment } from '@/types/database';

const statusColors: Record<string, string> = {
  scheduled: '#3b82f6',
  in_progress: '#f59e0b',
  completed: '#22c55e',
  cancelled: '#ef4444',
  no_show: '#6b7280',
};

export function TechnicianCalendar() {
  const { profile } = useAuthStore();
  const [events, setEvents] = useState<EventInput[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const loadAppointments = useCallback(async () => {
    if (!profile) return;
    const data = await getAppointments({ technician_id: profile.id });
    setAppointments(data);
    setEvents(
      data.map((apt) => ({
        id: apt.id,
        title: `${apt.customer?.first_name} ${apt.customer?.last_name} - ${apt.appointment_type}`,
        start: apt.start_time,
        end: apt.end_time,
        backgroundColor: statusColors[apt.status] || '#3b82f6',
        borderColor: statusColors[apt.status] || '#3b82f6',
      })),
    );
  }, [profile]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleEventClick = (info: EventClickArg) => {
    const apt = appointments.find((a) => a.id === info.event.id);
    if (apt) setSelectedAppointment(apt);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Calendar</h1>

      <Card>
        <CardContent className="p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            events={events}
            eventClick={handleEventClick}
            slotMinTime="06:00:00"
            slotMaxTime="20:00:00"
            allDaySlot={false}
            height="auto"
            expandRows={true}
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">
                    {selectedAppointment.customer?.first_name}{' '}
                    {selectedAppointment.customer?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <AppointmentStatusBadge status={selectedAppointment.status} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedAppointment.customer?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedAppointment.customer?.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{selectedAppointment.appointment_type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {format(new Date(selectedAppointment.start_time), 'MMM d, h:mm a')} -{' '}
                    {format(new Date(selectedAppointment.end_time), 'h:mm a')}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{selectedAppointment.address?.address_line}</p>
              </div>
              {selectedAppointment.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
