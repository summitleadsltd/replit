// ═══════════════════════════════════════════════════════════
// supabase/functions/assign-daily-leads/index.ts
// verify_jwt = TRUE
// Assigns daily leads to agents (fair round-robin distribution)
// Actions: assign | get_stats
// ═══════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_TIMEZONE = "America/New_York";

/** Returns today's date as YYYY-MM-DD in Eastern Time. */
function appToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: { user }, error: ae } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  if (ae || !user) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json();
    const { action } = body;

    // ── ASSIGN LEADS ──────────────────────────────────────────────
    if (action === "assign") {
      const { agentId, language, cap, campaignId } = body;
      const targetAgentId = agentId || user.id;
      const targetLanguage = language || "en";
      const targetCap = cap || 75;

      // Get agent's company
      const { data: profile } = await sb
        .from("profiles")
        .select("company_id")
        .eq("user_id", targetAgentId)
        .single();

      if (!profile?.company_id) {
        return json({ error: "Agent has no company assigned" }, 400);
      }

      // Check current assignment count
      const { count: currentCount } = await sb
        .from("daily_lead_assignments")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", targetAgentId)
        .eq("assigned_date", appToday()) // Eastern calendar day
        .eq("language", targetLanguage);

      const availableSlots = targetCap - (currentCount || 0);

      if (availableSlots <= 0) {
        return json({ 
          success: true, 
          assigned: 0, 
          message: "Daily cap reached",
          stats: { total_assigned: currentCount, cap: targetCap }
        });
      }

      // Call the database function to assign leads
      const { data: assignedCount, error: assignError } = await sb.rpc("assign_daily_leads", {
        p_agent_id: targetAgentId,
        p_language: targetLanguage,
        p_cap: targetCap,
        p_campaign_id: campaignId || null,
      });

      if (assignError) {
        return json({ error: "Assignment failed", details: assignError.message }, 500);
      }

      // Get updated stats
      const { data: stats } = await sb.rpc("get_agent_daily_stats", {
        p_agent_id: targetAgentId,
        p_date: appToday(), // Eastern calendar day
      });

      return json({
        success: true,
        assigned: assignedCount || 0,
        stats: stats?.[0] || { total_assigned: currentCount, contacted: 0, remaining: 0, language: targetLanguage },
      });
    }

    // ── GET STATS ─────────────────────────────────────────────────
    if (action === "get_stats") {
      const { agentId } = body;
      const targetAgentId = agentId || user.id;

      const today = appToday(); // Eastern calendar day

      // Get stats for all languages
      const { data: stats, error: statsError } = await sb.rpc("get_agent_daily_stats", {
        p_agent_id: targetAgentId,
        p_date: today,
      });

      if (statsError) {
        return json({ error: "Failed to get stats", details: statsError.message }, 500);
      }

      // Get assignments for detailed view
      const { data: assignments, error: assignmentsError } = await sb
        .from("daily_lead_assignments")
        .select("id, contact_id, language, status, assigned_at, contacts:contact_id(first_name, last_name, phone_e164)")
        .eq("agent_id", targetAgentId)
        .eq("assigned_date", today)
        .order("assigned_at", { ascending: false });

      return json({
        success: true,
        stats: stats || [],
        assignments: assignments || [],
      });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (err) {
    console.error("[assign-daily-leads] Error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
