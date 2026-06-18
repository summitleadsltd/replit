import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { technicianId, appointmentId, delayMinutes, reason } = await req.json();

    if (!technicianId || !appointmentId || !delayMinutes) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the current appointment
    const { data: currentAppointment, error: appointmentError } = await supabase
      .from("technician_appointments")
      .select("*")
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !currentAppointment) {
      return new Response(
        JSON.stringify({ error: "Appointment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all subsequent appointments for this technician on the same day
    const appointmentDate = new Date(currentAppointment.start_time).toISOString().split("T")[0];
    const { data: subsequentAppointments } = await supabase
      .from("technician_appointments")
      .select("*, contacts(*)")
      .eq("technician_id", technicianId)
      .gte("start_time", `${appointmentDate}T00:00:00`)
      .lte("start_time", `${appointmentDate}T23:59:59`)
      .gt("start_time", currentAppointment.start_time)
      .not("status", "in", "(cancelled,no_show)")
      .order("start_time", { ascending: true });

    if (!subsequentAppointments || subsequentAppointments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subsequent appointments to reschedule" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate new start times for subsequent appointments
    const delayMs = delayMinutes * 60 * 1000;
    const updatedAppointments = [];

    for (const apt of subsequentAppointments) {
      const originalStartTime = new Date(apt.start_time);
      const originalEndTime = new Date(apt.end_time);
      const duration = originalEndTime.getTime() - originalStartTime.getTime();

      const newStartTime = new Date(originalStartTime.getTime() + delayMs);
      const newEndTime = new Date(newStartTime.getTime() + duration);

      // Update the appointment
      const { error: updateError } = await supabase
        .from("technician_appointments")
        .update({
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
        })
        .eq("id", apt.id);

      if (updateError) {
        console.error(`Error updating appointment ${apt.id}:`, updateError);
        continue;
      }

      updatedAppointments.push({
        id: apt.id,
        originalStartTime: originalStartTime.toISOString(),
        newStartTime: newStartTime.toISOString(),
        delayMinutes,
      });

      // Send notification to customer
      if (apt.contacts) {
        await sendCustomerNotification(supabase, apt, newStartTime, delayMinutes, reason);
      }
    }

    // Update current appointment status to indicate delay
    await supabase
      .from("technician_appointments")
      .update({
        status: "running_late",
      })
      .eq("id", appointmentId);

    return new Response(
      JSON.stringify({
        success: true,
        rescheduledCount: updatedAppointments.length,
        updatedAppointments,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in dynamic reschedule:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendCustomerNotification(
  supabase: any,
  appointment: any,
  newStartTime: Date,
  delayMinutes: number,
  reason?: string
) {
  const contact = appointment.contacts;
  if (!contact) return;

  const formattedTime = newStartTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const message = reason
    ? `Your appointment has been delayed by ${delayMinutes} minutes due to: ${reason}. New arrival time: ${formattedTime}`
    : `Your appointment has been delayed by ${delayMinutes} minutes. New arrival time: ${formattedTime}`;

  // Send email notification
  if (contact.email) {
    // TODO: Integrate with email service (SendGrid, Resend, etc.)
    console.log(`Sending email to ${contact.email}: ${message}`);
  }

  // Send SMS notification
  if (contact.phone_e164) {
    // TODO: Integrate with SMS service (Twilio, etc.)
    console.log(`Sending SMS to ${contact.phone_e164}: ${message}`);
  }

  // Log the notification
  await supabase.from("appointment_notifications").insert({
    appointment_id: appointment.id,
    contact_id: contact.id,
    notification_type: "delay",
    message,
    sent_at: new Date().toISOString(),
  });
}
