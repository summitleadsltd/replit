import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Navigation, Clock, Car, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface TechnicianLocation {
  latitude: number;
  longitude: number;
  recorded_at: string;
  speed?: number;
}

interface Appointment {
  id: string;
  appointment_at: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  technicians: {
    name: string;
    phone: string;
  };
}

export default function CustomerTracking() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [technicianLocation, setTechnicianLocation] = useState<TechnicianLocation | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadTrackingData();
      const interval = setInterval(loadTrackingData, 60000); // Update every 60 seconds
      return () => clearInterval(interval);
    }
  }, [token]);

  const loadTrackingData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get appointment by tracking token
      const { data: apt, error: aptError } = await supabase
        .from("appointments")
        .select("*, technicians(*)")
        .eq("tracking_token", token)
        .single();

      if (aptError || !apt) {
        setError("Tracking link not found or expired");
        return;
      }

      setAppointment(apt);

      // Get latest technician location
      const { data: location } = await supabase
        .from("technician_location_history")
        .select("*")
        .eq("technician_id", apt.technician_id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      if (location) {
        setTechnicianLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          recorded_at: location.recorded_at,
          speed: location.speed,
        });

        // Calculate ETA (simplified - in production use Google Distance Matrix API)
        const timeDiff = new Date(apt.appointment_at).getTime() - new Date().getTime();
        if (timeDiff > 0) {
          setEta(Math.round(timeDiff / 60000)); // Convert to minutes
        } else {
          setEta(0);
        }
      }
    } catch (error) {
      console.error("Error loading tracking data:", error);
      setError("Failed to load tracking data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading tracking information...</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Tracking Not Available</h2>
            <p className="text-muted-foreground">{error || "This tracking link may have expired"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const appointmentTime = new Date(appointment.appointment_at);
  const isEnRoute = technicianLocation && eta !== null && eta > 0;
  const isArrived = eta !== null && eta <= 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Technician Tracker</CardTitle>
            <p className="text-muted-foreground">
              Track your technician's arrival in real-time
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Technician Info */}
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <Car className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{appointment.technicians?.name}</div>
                <div className="text-sm text-muted-foreground">{appointment.technicians?.phone}</div>
              </div>
              {isEnRoute && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{eta} min</div>
                  <div className="text-xs text-muted-foreground">ETA</div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="text-center py-8">
              {isArrived ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <MapPin className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="text-xl font-semibold text-green-600">Technician Arrived</div>
                  <p className="text-muted-foreground">Your technician is at your location</p>
                </div>
              ) : isEnRoute ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Navigation className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="text-xl font-semibold text-blue-600">On the Way</div>
                  <p className="text-muted-foreground">
                    Arriving in approximately {eta} minutes
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <Clock className="w-8 h-8 text-gray-600" />
                  </div>
                  <div className="text-xl font-semibold text-gray-600">Scheduled</div>
                  <p className="text-muted-foreground">
                    Appointment at {format(appointmentTime, "h:mm a")}
                  </p>
                </div>
              )}
            </div>

            {/* Appointment Details */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium">Location</div>
                  <div className="text-muted-foreground">
                    {[appointment.address, appointment.city, appointment.state, appointment.zip_code]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium">Scheduled Time</div>
                  <div className="text-muted-foreground">
                    {format(appointmentTime, "EEEE, MMMM d, yyyy at h:mm a")}
                  </div>
                </div>
              </div>
            </div>

            {/* Last Updated */}
            {technicianLocation && (
              <div className="text-xs text-muted-foreground text-center">
                Last updated: {format(new Date(technicianLocation.recorded_at), "h:mm a")}
                <br />
                Updates every 60 seconds
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Need help? Contact our office</p>
        </div>
      </div>
    </div>
  );
}
