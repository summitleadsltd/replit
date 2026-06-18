import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Clock, CheckCircle, AlertCircle, Navigation, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { formatEST } from "@/lib/timezone";

interface Technician {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
  home_address: string | null;
}

interface TechnicianLocation {
  technician_id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  battery_level: number | null;
  captured_at: string;
}

interface TechnicianAppointment {
  id: string;
  technician_id: string;
  lead_address: string | null;
  start_time: string;
  end_time: string;
  status: string;
  contact_id: string | null;
}

interface TechnicianWithStatus extends Technician {
  currentLocation: TechnicianLocation | null;
  todayAppointments: TechnicianAppointment[];
  currentAppointment: TechnicianAppointment | null;
  status: "available" | "on_route" | "in_progress" | "completed";
}

export default function DispatchCenter() {
  const [technicians, setTechnicians] = useState<TechnicianWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianWithStatus | null>(null);

  useEffect(() => {
    loadDispatchData();
    
    // Subscribe to realtime updates for technician locations
    const channel = supabase
      .channel("technician_locations")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "technician_location_history",
        },
        () => loadDispatchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadDispatchData = async () => {
    setLoading(true);
    try {
      // Get all active technicians
      const { data: techs } = await supabase
        .from("technicians")
        .select("*")
        .eq("is_active", true);

      if (!techs) return;

      // Get today's date bounds in Eastern timezone
      const today = new Date();
      const dayStart = new Date(today);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(today);
      dayEnd.setHours(23, 59, 59, 999);

      // Get latest location for each technician
      const { data: locations } = await supabase
        .from("technician_location_history")
        .select("*")
        .gte("captured_at", dayStart.toISOString())
        .order("captured_at", { ascending: false });

      // Get today's appointments for each technician
      const { data: appointments } = await supabase
        .from("technician_appointments")
        .select("*")
        .gte("start_time", dayStart.toISOString())
        .lte("start_time", dayEnd.toISOString())
        .not("status", "in", "(cancelled,no_show)")
        .order("start_time", { ascending: true });

      // Combine data
      const techsWithStatus: TechnicianWithStatus[] = techs.map((tech) => {
        const techLocations = locations?.filter((l) => l.technician_id === tech.id) || [];
        const latestLocation = techLocations[0] || null;

        const techAppointments = appointments?.filter((a) => a.technician_id === tech.id) || [];
        
        // Determine current appointment based on time
        const now = new Date();
        const currentAppointment = techAppointments.find((apt) => {
          const start = new Date(apt.start_time);
          const end = new Date(apt.end_time);
          return now >= start && now <= end;
        }) || null;

        // Determine overall status
        let status: "available" | "on_route" | "in_progress" | "completed" = "available";
        if (currentAppointment) {
          if (currentAppointment.status === "on_route" || currentAppointment.status === "en_route") {
            status = "on_route";
          } else if (currentAppointment.status === "on_site" || currentAppointment.status === "in_progress") {
            status = "in_progress";
          } else if (currentAppointment.status === "completed") {
            status = "completed";
          }
        } else if (techAppointments.length > 0) {
          const lastApt = techAppointments[techAppointments.length - 1];
          if (new Date(lastApt.end_time) < now) {
            status = "completed";
          }
        }

        return {
          ...tech,
          currentLocation: latestLocation,
          todayAppointments: techAppointments,
          currentAppointment,
          status,
        };
      });

      setTechnicians(techsWithStatus);
    } catch (error) {
      console.error("Error loading dispatch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
      available: { color: "bg-green-500", icon: CheckCircle, label: "Available" },
      on_route: { color: "bg-blue-500", icon: Navigation, label: "On Route" },
      in_progress: { color: "bg-yellow-500", icon: Clock, label: "In Progress" },
      completed: { color: "bg-gray-500", icon: CheckCircle, label: "Completed" },
    };

    const config = statusConfig[status] || statusConfig.available;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      available: "border-green-500",
      on_route: "border-blue-500",
      in_progress: "border-yellow-500",
      completed: "border-gray-500",
    };
    return colors[status] || colors.available;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dispatch data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dispatch Center</h1>
          <p className="text-muted-foreground">
            Real-time technician tracking and appointment management
          </p>
        </div>
        <Button onClick={loadDispatchData} variant="outline">
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="map" className="space-y-4">
        <TabsList>
          <TabsTrigger value="map">Map View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Technician Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MapPin className="w-12 h-12 mx-auto mb-2" />
                  <p>Map view will display technician locations</p>
                  <p className="text-sm">Requires Google Maps API integration</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {technicians.map((tech) => (
                  <div
                    key={tech.id}
                    className={`p-3 rounded-lg border-2 ${getStatusColor(tech.status)} cursor-pointer hover:bg-accent`}
                    onClick={() => setSelectedTechnician(tech)}
                  >
                    <div className="font-medium">{tech.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {tech.currentLocation ? (
                        <span>Updated {formatEST(new Date(tech.currentLocation.captured_at))}</span>
                      ) : (
                        <span>No location data</span>
                      )}
                    </div>
                    {getStatusBadge(tech.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <div className="grid gap-4">
            {technicians.map((tech) => (
              <Card
                key={tech.id}
                className={`border-l-4 ${getStatusColor(tech.status)}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{tech.name}</CardTitle>
                    {getStatusBadge(tech.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Phone</div>
                      <div className="font-medium">{tech.phone}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Home Address</div>
                      <div className="font-medium">{tech.home_address || "Not set"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Today's Appointments</div>
                      <div className="font-medium">{tech.todayAppointments.length}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Battery</div>
                      <div className="font-medium">
                        {tech.currentLocation?.battery_level
                          ? `${tech.currentLocation.battery_level}%`
                          : "N/A"}
                      </div>
                    </div>
                  </div>

                  {tech.currentLocation && (
                    <div className="text-sm">
                      <div className="text-muted-foreground">Last Location</div>
                      <div className="font-medium">
                        {tech.currentLocation.latitude.toFixed(6)}, {tech.currentLocation.longitude.toFixed(6)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Updated {formatEST(new Date(tech.currentLocation.captured_at))}
                      </div>
                    </div>
                  )}

                  {tech.currentAppointment && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Clock className="w-4 h-4" />
                        Current Appointment
                      </div>
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="text-muted-foreground">Time:</span>{" "}
                          {formatEST(new Date(tech.currentAppointment.start_time))} –{" "}
                          {formatEST(new Date(tech.currentAppointment.end_time))}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Address:</span>{" "}
                          {tech.currentAppointment.lead_address || "N/A"}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>{" "}
                          <Badge variant="outline">{tech.currentAppointment.status}</Badge>
                        </div>
                      </div>
                    </div>
                  )}

                  {tech.todayAppointments.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Today's Schedule</div>
                      <div className="space-y-2">
                        {tech.todayAppointments.map((apt) => (
                          <div
                            key={apt.id}
                            className="flex items-center justify-between p-2 rounded hover:bg-accent text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span>
                                {formatEST(new Date(apt.start_time))} –{" "}
                                {formatEST(new Date(apt.end_time))}
                              </span>
                            </div>
                            <Badge variant="outline">{apt.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="unassigned">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Unassigned Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No unassigned jobs at this time.</p>
                <p className="text-sm">Jobs will appear here when they need technician assignment.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
