import { useEffect, useState } from 'react';
import { getTodayAppointments, getWeekAppointments } from '@/services/appointmentService';
import { getActiveTechnicians } from '@/services/technicianService';
import { StatCard } from '@/components/shared/StatCard';
import { AppointmentStatusBadge } from '@/components/shared/AppointmentStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Users, Clock, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import type { Appointment, User } from '@/types/database';

export function SchedulerDashboard() {
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [weekAppts, setWeekAppts] = useState<Appointment[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [today, week, techs] = await Promise.all([
          getTodayAppointments(),
          getWeekAppointments(),
          getActiveTechnicians(),
        ]);
        setTodayAppts(today);
        setWeekAppts(week);
        setTechnicians(techs);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const pendingBookings = todayAppts.filter((a) => a.status === 'scheduled').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scheduler Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Appointments" value={todayAppts.length} icon={Calendar} />
        <StatCard title="This Week" value={weekAppts.length} icon={Clock} />
        <StatCard title="Available Technicians" value={technicians.length} icon={Users} />
        <StatCard title="Pending Bookings" value={pendingBookings} icon={BookOpen} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Today's Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No appointments today</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">
                        {apt.customer?.first_name} {apt.customer?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {apt.technician?.name} | {format(new Date(apt.start_time), 'h:mm a')}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={apt.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Technicians</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {technicians.map((tech) => (
                <div key={tech.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {tech.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{tech.name}</p>
                    <p className="text-xs text-muted-foreground">{tech.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
