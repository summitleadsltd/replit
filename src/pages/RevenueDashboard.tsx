import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { DollarSign, TrendingUp, Users, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface RevenueMetrics {
  totalRevenue: number;
  totalProposals: number;
  acceptedProposals: number;
  conversionRate: number;
  completedAppointments: number;
  totalAppointments: number;
  completionRate: number;
  averageJobValue: number;
}

interface TechnicianRevenue {
  technicianId: string;
  technicianName: string;
  totalRevenue: number;
  completedJobs: number;
  averageJobValue: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
  proposals: number;
  accepted: number;
}

export default function RevenueDashboard() {
  const [timeRange, setTimeRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [technicianRevenue, setTechnicianRevenue] = useState<TechnicianRevenue[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [timeRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const days = parseInt(timeRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Load overall metrics
      const { data: proposals } = await supabase
        .from("proposals")
        .select("*")
        .gte("proposal_date", startDate.toISOString())
        .eq("status", "accepted");

      const { data: allProposals } = await supabase
        .from("proposals")
        .select("*")
        .gte("proposal_date", startDate.toISOString());

      const { data: appointments } = await supabase
        .from("appointments")
        .select("*")
        .gte("appointment_at", startDate.toISOString());

      const completedAppointments = appointments?.filter((a) => a.status === "completed") || [];

      const totalRevenue = proposals?.reduce((sum, p) => sum + (p.estimated_value || 0), 0) || 0;
      const averageJobValue = proposals?.length > 0 ? totalRevenue / proposals.length : 0;

      setMetrics({
        totalRevenue,
        totalProposals: allProposals?.length || 0,
        acceptedProposals: proposals?.length || 0,
        conversionRate: allProposals?.length > 0 ? ((proposals?.length || 0) / allProposals.length) * 100 : 0,
        completedAppointments: completedAppointments.length,
        totalAppointments: appointments?.length || 0,
        completionRate: appointments?.length > 0 ? (completedAppointments.length / appointments.length) * 100 : 0,
        averageJobValue,
      });

      // Load technician revenue
      const { data: techRevenue } = await supabase
        .from("proposals")
        .select(`
          estimated_value,
          appointment_outcome_id,
          appointment_outcomes!inner (
            technician_id,
            technicians!inner (name)
          )
        `)
        .gte("proposal_date", startDate.toISOString())
        .eq("status", "accepted");

      const techMap = new Map<string, TechnicianRevenue>();
      techRevenue?.forEach((p: any) => {
        const techId = p.appointment_outcomes.technician_id;
        const techName = p.appointment_outcomes.technicians.name;
        const value = p.estimated_value || 0;

        if (!techMap.has(techId)) {
          techMap.set(techId, {
            technicianId: techId,
            technicianName: techName,
            totalRevenue: 0,
            completedJobs: 0,
            averageJobValue: 0,
          });
        }

        const tech = techMap.get(techId)!;
        tech.totalRevenue += value;
        tech.completedJobs += 1;
      });

      techMap.forEach((tech) => {
        tech.averageJobValue = tech.completedJobs > 0 ? tech.totalRevenue / tech.completedJobs : 0;
      });

      setTechnicianRevenue(Array.from(techMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue));

      // Load daily revenue
      const dailyData: DailyRevenue[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const { data: dayProposals } = await supabase
          .from("proposals")
          .select("*")
          .eq("proposal_date", dateStr);

        const accepted = dayProposals?.filter((p) => p.status === "accepted") || [];
        const revenue = accepted.reduce((sum, p) => sum + (p.estimated_value || 0), 0);

        dailyData.push({
          date: dateStr,
          revenue,
          proposals: dayProposals?.length || 0,
          accepted: accepted.length,
        });
      }

      setDailyRevenue(dailyData);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Revenue Dashboard</h1>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.totalRevenue.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.acceptedProposals || 0} accepted proposals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.conversionRate.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.totalProposals || 0} total proposals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.completionRate.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.completedAppointments || 0} of {metrics?.totalAppointments || 0} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Job Value</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.averageJobValue.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Per accepted proposal</p>
          </CardContent>
        </Card>
      </div>

      {/* Technician Revenue */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Technician</CardTitle>
        </CardHeader>
        <CardContent>
          {technicianRevenue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revenue data available</p>
          ) : (
            <div className="space-y-4">
              {technicianRevenue.map((tech) => (
                <div key={tech.technicianId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">{tech.technicianName}</div>
                    <div className="text-sm text-muted-foreground">
                      {tech.completedJobs} completed jobs
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">${tech.totalRevenue.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">
                      Avg: ${tech.averageJobValue.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyRevenue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No daily data available</p>
          ) : (
            <div className="space-y-2">
              {dailyRevenue.map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-24 text-sm">{format(new Date(day.date), "MMM d")}</div>
                  <div className="flex-1 h-8 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${Math.min((day.revenue / (Math.max(...dailyRevenue.map((d) => d.revenue)) || 1)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="w-24 text-right text-sm font-medium">
                    ${day.revenue.toLocaleString()}
                  </div>
                  <div className="w-20 text-right text-xs text-muted-foreground">
                    {day.accepted}/{day.proposals}
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
