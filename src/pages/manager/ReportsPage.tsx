import { useEffect, useState } from 'react';
import { getAppointments } from '@/services/appointmentService';
import { getActiveTechnicians } from '@/services/technicianService';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Users, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { startOfMonth, endOfMonth, format, differenceInMinutes, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import type { Appointment, User } from '@/types/database';

export function ReportsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date();
        const [appts, techs] = await Promise.all([
          getAppointments({
            start_date: startOfMonth(now).toISOString(),
            end_date: endOfMonth(now).toISOString(),
          }),
          getActiveTechnicians(),
        ]);
        setAppointments(appts);
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

  const completed = appointments.filter((a) => a.status === 'completed');
  const cancelled = appointments.filter((a) => a.status === 'cancelled');
  const completionRate = appointments.length > 0
    ? Math.round((completed.length / appointments.length) * 100)
    : 0;

  // Average appointment duration
  const avgDuration = completed.length > 0
    ? Math.round(
        completed.reduce(
          (sum, a) => sum + differenceInMinutes(new Date(a.end_time), new Date(a.start_time)),
          0,
        ) / completed.length,
      )
    : 0;

  // Appointments per technician
  const techStats = technicians.map((tech) => {
    const techAppts = appointments.filter((a) => a.technician_id === tech.id);
    const techCompleted = techAppts.filter((a) => a.status === 'completed');
    return {
      name: tech.name,
      total: techAppts.length,
      completed: techCompleted.length,
      rate: techAppts.length > 0 ? Math.round((techCompleted.length / techAppts.length) * 100) : 0,
    };
  }).sort((a, b) => b.total - a.total);

  // Appointments per day this week
  const now = new Date();
  const weekDays = eachDayOfInterval({
    start: startOfWeek(now),
    end: endOfWeek(now),
  });

  const dailyCounts = weekDays.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const count = appointments.filter(
      (a) => format(new Date(a.start_time), 'yyyy-MM-dd') === dayStr,
    ).length;
    return { day: format(day, 'EEE'), count };
  });

  const maxDaily = Math.max(...dailyCounts.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Appointments" value={appointments.length} icon={Calendar} description="This month" />
        <StatCard title="Completed" value={completed.length} icon={CheckCircle} />
        <StatCard title="Cancelled" value={cancelled.length} icon={XCircle} />
        <StatCard title="Avg Duration" value={`${avgDuration}min`} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Appointments per Technician</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {techStats.map((tech) => (
                <div key={tech.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{tech.name}</span>
                    <span className="text-muted-foreground">
                      {tech.completed}/{tech.total} ({tech.rate}%)
                    </span>
                  </div>
                  <Progress value={tech.rate} className="h-2" />
                </div>
              ))}
              {techStats.length === 0 && (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appointments per Day (This Week)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dailyCounts.map((d) => (
                <div key={d.day} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-8">{d.day}</span>
                  <div className="flex-1">
                    <div
                      className="h-6 bg-primary/20 rounded flex items-center"
                      style={{ width: `${(d.count / maxDaily) * 100}%`, minWidth: d.count > 0 ? '20px' : '0' }}
                    >
                      <div
                        className="h-full bg-primary rounded"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground w-6 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capacity Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="12"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="12"
                    strokeDasharray={`${completionRate * 3.52} 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold">{completionRate}%</span>
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Completion Rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduling Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm">Total Scheduled</span>
                </div>
                <span className="font-medium">{appointments.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm">Avg per Technician</span>
                </div>
                <span className="font-medium">
                  {technicians.length > 0 ? Math.round(appointments.length / technicians.length) : 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm">Avg Duration</span>
                </div>
                <span className="font-medium">{avgDuration} min</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm">Avg per Day</span>
                </div>
                <span className="font-medium">
                  {Math.round(appointments.length / 30)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
