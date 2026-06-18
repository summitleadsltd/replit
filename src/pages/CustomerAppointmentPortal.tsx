import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Phone, Mail, CheckCircle, XCircle, CalendarX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

interface Appointment {
  id: string;
  appointment_at: string;
  status: string;
  confirmation_status: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  notes: string;
  contacts: {
    first_name: string;
    last_name: string;
    phone_e164: string;
    email: string;
  };
  technicians: {
    name: string;
    phone: string;
  };
}

export default function CustomerAppointmentPortal() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (token) {
      loadAppointment();
    }
  }, [token]);

  const loadAppointment = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("appointments")
        .select("*, contacts(*), technicians(*)")
        .eq("confirmation_token", token)
        .single();

      if (error) throw error;
      setAppointment(data);
    } catch (error) {
      console.error("Error loading appointment:", error);
      toast.error("Failed to load appointment. Please check your link.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!appointment) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          confirmation_status: "confirmed",
          status: "confirmed",
        })
        .eq("id", appointment.id);

      if (error) throw error;
      toast.success("Appointment confirmed successfully!");
      loadAppointment();
    } catch (error) {
      console.error("Error confirming appointment:", error);
      toast.error("Failed to confirm appointment. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = () => {
    toast.info("Rescheduling feature coming soon. Please contact us to reschedule.");
  };

  const handleCancel = async () => {
    if (!appointment) return;
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          confirmation_status: "cancelled",
          status: "cancelled",
        })
        .eq("id", appointment.id);

      if (error) throw error;
      toast.success("Appointment cancelled successfully.");
      loadAppointment();
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast.error("Failed to cancel appointment. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your appointment...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Appointment Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This appointment link may have expired or is invalid.
            </p>
            <p className="text-sm text-muted-foreground">
              Please contact our office for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isConfirmed = appointment.confirmation_status === "confirmed";
  const isCancelled = appointment.status === "cancelled";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Your Appointment</CardTitle>
            <p className="text-muted-foreground">
              {appointment.contacts.first_name} {appointment.contacts.last_name}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <Badge
                variant={isConfirmed ? "default" : isCancelled ? "destructive" : "secondary"}
                className="text-sm px-3 py-1"
              >
                {isConfirmed ? "Confirmed" : isCancelled ? "Cancelled" : "Pending"}
              </Badge>
              {appointment.technicians && (
                <div className="text-sm text-muted-foreground">
                  Technician: {appointment.technicians.name}
                </div>
              )}
            </div>

            {/* Appointment Details */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium">Date & Time</div>
                  <div className="text-muted-foreground">
                    {format(new Date(appointment.appointment_at), "EEEE, MMMM d, yyyy")}
                  </div>
                  <div className="text-muted-foreground">
                    {format(new Date(appointment.appointment_at), "h:mm a")}
                  </div>
                </div>
              </div>

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

              {appointment.technicians?.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="font-medium">Technician Phone</div>
                    <div className="text-muted-foreground">{appointment.technicians.phone}</div>
                  </div>
                </div>
              )}

              {appointment.contacts.phone_e164 && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="font-medium">Your Phone</div>
                    <div className="text-muted-foreground">{appointment.contacts.phone_e164}</div>
                  </div>
                </div>
              )}

              {appointment.contacts.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="font-medium">Your Email</div>
                    <div className="text-muted-foreground">{appointment.contacts.email}</div>
                  </div>
                </div>
              )}
            </div>

            {appointment.notes && (
              <div className="bg-muted p-4 rounded-lg">
                <div className="font-medium mb-1">Notes</div>
                <div className="text-sm text-muted-foreground">{appointment.notes}</div>
              </div>
            )}

            {/* Action Buttons */}
            {!isCancelled && (
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                {!isConfirmed && (
                  <>
                    <Button
                      onClick={handleConfirm}
                      disabled={actionLoading}
                      className="flex-1"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm Appointment
                    </Button>
                    <Button
                      onClick={handleReschedule}
                      disabled={actionLoading}
                      variant="outline"
                      className="flex-1"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Reschedule
                    </Button>
                  </>
                )}
                <Button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  variant="destructive"
                  className="flex-1"
                >
                  <CalendarX className="w-4 h-4 mr-2" />
                  Cancel Appointment
                </Button>
              </div>
            )}

            {isCancelled && (
              <div className="text-center py-4 bg-destructive/10 rounded-lg">
                <CalendarX className="w-12 h-12 text-destructive mx-auto mb-2" />
                <p className="text-destructive font-medium">This appointment has been cancelled</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please contact us to schedule a new appointment
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Need help? Contact our office</p>
          <p className="mt-1">We're here to assist you</p>
        </div>
      </div>
    </div>
  );
}
