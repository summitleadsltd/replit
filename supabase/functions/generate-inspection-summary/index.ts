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
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { outcomeId } = await req.json();

    if (!outcomeId) {
      return new Response(
        JSON.stringify({ error: "Missing outcome ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the inspection outcome data
    const { data: outcome, error: outcomeError } = await supabase
      .from("appointment_outcomes")
      .select("*, appointments(*, contacts(*))")
      .eq("id", outcomeId)
      .single();

    if (outcomeError || !outcome) {
      return new Response(
        JSON.stringify({ error: "Inspection outcome not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch photos for this appointment
    const { data: photos } = await supabase
      .from("appointment_photos")
      .select("*")
      .eq("appointment_id", outcome.appointment_id);

    // Build the prompt for AI
    const prompt = buildInspectionSummaryPrompt(outcome, photos || []);

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a professional solar inspection assistant. Generate a concise, professional summary of inspection findings.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error("OpenAI API error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to generate AI summary" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiResponse.json();
    const aiSummary = openaiData.choices[0]?.message?.content || "";

    // Save the AI summary
    const { error: updateError } = await supabase
      .from("appointment_outcomes")
      .update({
        ai_summary: aiSummary,
        ai_summary_generated_at: new Date().toISOString(),
        ai_summary_model: "gpt-4",
      })
      .eq("id", outcomeId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        summary: aiSummary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating inspection summary:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildInspectionSummaryPrompt(outcome: any, photos: any[]): string {
  const sections = [];

  // Property Information
  sections.push("## Property Information");
  if (outcome.roof_type) sections.push(`- Roof Type: ${outcome.roof_type}`);
  if (outcome.roof_age) sections.push(`- Roof Age: ${outcome.roof_age} years`);
  if (outcome.panel_size) sections.push(`- Panel Size: ${outcome.panel_size}`);
  if (outcome.shading) sections.push(`- Shading: ${outcome.shading}`);
  if (outcome.electrical_condition) sections.push(`- Electrical Condition: ${outcome.electrical_condition}`);

  // Inspection Outcome
  sections.push("\n## Inspection Outcome");
  sections.push(`- Result: ${outcome.outcome}`);
  if (outcome.next_step) sections.push(`- Next Step: ${outcome.next_step}`);

  // Photos
  if (photos.length > 0) {
    sections.push("\n## Photos Uploaded");
    const photoTypes = photos.map((p) => p.photo_type).join(", ");
    sections.push(`- Photo Types: ${photoTypes}`);
    sections.push(`- Total Photos: ${photos.length}`);
  }

  // Duration
  if (outcome.inspection_duration_minutes) {
    sections.push(`\n## Inspection Duration`);
    sections.push(`- Duration: ${outcome.inspection_duration_minutes} minutes`);
  }

  // Notes
  if (outcome.notes) {
    sections.push(`\n## Technician Notes`);
    sections.push(outcome.notes);
  }

  return `Generate a professional inspection summary based on the following data:\n\n${sections.join("\n")}\n\nThe summary should be concise, professional, and highlight key findings and recommendations.`;
}
