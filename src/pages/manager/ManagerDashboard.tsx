import { useEffect, useState } from 'react';
import { getAppointments, getTodayAppointments, getWeekAppointments } from '@/services/appointmentService';
import { getActiveTechnicians } from '@/services/technicianService';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Users, TrendingUp, BarChart3 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import type { Appointment, User } from '@/types/database';

export function ManagerDashboard() {
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [weekAppts, setWeekAppts] = useState<Appointment[]>([]);
  const [monthAppts, setMonthAppts] = useState<Appointment[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date();
        const [today, week, month, techs] = await Promise.all([
          getTodayAppointments(),
          getWeekAppointments(),
          getAppointments({
            start_date: startOfMonth(now).toISOString(),
            end_date: endOfMonth(now).toISOString(),
          }),
          getActiveTechnicians(),
        ]);
        setTodayAppts(today);
        setWeekAppts(week);
        setMonthAppts(month);
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

  const completedMonth = monthAppts.filter((a) => a.status === 'completed').length;
  const completionRate = monthAppts.length > 0 ? Math.round((completedMonth / monthAppts.length) * 100) : 0;

  // Technician utilization
  const techUtilization = technicians.map((tech) => {
    const techAppts = weekAppts.filter((a) => a.technician_id === tech.id);
    return { ...tech, appointmentCount: techAppts.length };
  }).sort((a, b) => b.appointmentCount - a.appointmentCount);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manager Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Appointments" value={todayAppts.length} icon={Calendar} />
        <StatCard title="This Week" value={weekAppts.length} icon={TrendingUp} />
        <StatCard title="Active Technicians" value={technicians.length} icon={Users} />
        <StatCard title="Completion Rate" value={`${completionRate}%`} icon={BarChart3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Technician Utilization (This Week)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {techUtilization.map((tech) => (
                <div key={tech.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
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
                  <div className="text-right">
                    <p className="font-medium text-sm">{tech.appointmentCount}</p>
                    <p className="text-xs text-muted-foreground">appointments</p>
                  </div>
                </div>
              ))}
              {techUtilization.length === 0 && (
                <p className="text-sm text-muted-foreground">No technicians</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Bookings</CardTitle>
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
                        {apt.technician?.name} | {format(new Date(apt.start_time), 'EEE h:mm a')}
                      </p>
                    </div>
                    <span className="text-xs capitalize px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {apt.status}
                    </span>
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
