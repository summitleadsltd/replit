import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getTodayAppointments, getWeekAppointments } from '@/services/appointmentService';
import { StatCard } from '@/components/shared/StatCard';
import { AppointmentStatusBadge } from '@/components/shared/AppointmentStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, CheckCircle, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import type { Appointment } from '@/types/database';

export function TechnicianDashboard() {
  const { profile } = useAuthStore();
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [weekAppts, setWeekAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      try {
        const [today, week] = await Promise.all([
          getTodayAppointments(profile.id),
          getWeekAppointments(profile.id),
        ]);
        setTodayAppts(today);
        setWeekAppts(week);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile]);

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const completedToday = todayAppts.filter((a) => a.status === 'completed').length;
  const utilization = todayAppts.length > 0 ? Math.round((completedToday / todayAppts.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Appointments" value={todayAppts.length} icon={Calendar} />
        <StatCard title="This Week" value={weekAppts.length} icon={Clock} />
        <StatCard title="Completed Today" value={completedToday} icon={CheckCircle} />
        <StatCard title="Utilization" value={`${utilization}%`} icon={MapPin} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
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
                        {format(new Date(apt.start_time), 'h:mm a')} -{' '}
                        {format(new Date(apt.end_time), 'h:mm a')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {apt.address?.address_line}
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
            <CardTitle>Upcoming This Week</CardTitle>
          </CardHeader>
          <CardContent>
            {weekAppts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming appointments</p>
            ) : (
              <div className="space-y-3">
                {weekAppts.slice(0, 8).map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">
                        {apt.customer?.first_name} {apt.customer?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(apt.start_time), 'EEE, MMM d - h:mm a')}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={apt.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
