import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { appointmentId, method = "email" } = await req.json();

    if (!appointmentId) {
      return new Response(
        JSON.stringify({ error: "appointmentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get appointment details with contact information
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(`
        *,
        contacts (
          first_name,
          last_name,
          email,
          phone_e164
        )
      `)
      .eq("id", appointmentId)
      .single();

    if (appointmentError || !appointment) {
      return new Response(
        JSON.stringify({ error: "Appointment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contact = appointment.contacts;
    const appointmentTime = new Date(appointment.appointment_at);
    const confirmationUrl = `${supabaseUrl}/confirm-appointment/${appointment.id}`;

    let messageSent = false;
    let error = null;

    // Send confirmation based on method
    if (method === "email" && contact.email) {
      // Email confirmation (would integrate with SendGrid, Resend, etc.)
      console.log(`Sending email confirmation to ${contact.email}`);
      // TODO: Implement actual email sending
      messageSent = true;
    } else if (method === "sms" && contact.phone_e164) {
      // SMS confirmation (would integrate with Twilio, etc.)
      console.log(`Sending SMS confirmation to ${contact.phone_e164}`);
      // TODO: Implement actual SMS sending
      messageSent = true;
    } else if (method === "whatsapp" && contact.phone_e164) {
      // WhatsApp confirmation (would integrate with WhatsApp Business API)
      console.log(`Sending WhatsApp confirmation to ${contact.phone_e164}`);
      // TODO: Implement actual WhatsApp sending
      messageSent = true;
    }

    // Update appointment with confirmation attempt
    if (messageSent) {
      await supabase
        .from("appointments")
        .update({
          confirmation_attempted_at: new Date().toISOString(),
          confirmation_status: "pending",
        })
        .eq("id", appointmentId);
    }

    return new Response(
      JSON.stringify({
        success: messageSent,
        message: messageSent
          ? "Confirmation sent successfully"
          : "No contact method available",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
