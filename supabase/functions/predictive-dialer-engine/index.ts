// supabase/functions/predictive-dialer-engine/index.ts
// verify_jwt = TRUE
// Predictive dialer tick: computes pacing ratio and places outbound calls
// based on available agents, active calls, and historical connect/abandon rates.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const campaignId = body?.campaign_id;
    if (!campaignId) return json({ error: "campaign_id required" }, 400);

    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Get campaign settings
    const { data: campaign, error: campErr } = await sb
      .from("campaigns")
      .select("id, name, status, dial_mode, predictive_ratio, max_abandon_rate")
      .eq("id", campaignId)
      .single();
    if (campErr || !campaign) return json({ error: "Campaign not found" }, 404);
    if (campaign.status !== "active") return json({ error: "Campaign is not active" }, 400);

    // Count available agents (status = 'available' or 'on_call')
    const { count: availableAgents } = await sb
      .from("agent_sessions")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["available", "on_call"]);

    // Count currently active calls
    const { count: activeCalls } = await sb
      .from("call_sessions")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["initiated", "answered"]);

    // Calculate historical connect rate (last 100 calls)
    const { data: recentCalls } = await sb
      .from("call_attempts")
      .select("outcome")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(100);

    const total = recentCalls?.length || 0;
    const connected = recentCalls?.filter((c: { outcome: string }) => c.outcome === "connected" || c.outcome === "appointment_booked").length || 0;
    const abandoned = recentCalls?.filter((c: { outcome: string }) => c.outcome === "abandoned" || c.outcome === "no_answer").length || 0;
    const connectRate = total > 10 ? connected / total : 0.3; // Default 30% if insufficient data
    const abandonRate = total > 10 ? (abandoned / total) * 100 : 0;

    // Role check: only admin/manager can run predictive dialer
    const { data: userRoles } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAuthorized = (userRoles ?? []).some((r: { role: string }) =>
      ["admin", "manager", "team_leader"].includes(r.role)
    );
    if (!isAuthorized) {
      return json({ error: "Forbidden: admin/manager/team_leader only" }, 403);
    }

    // Pacing ratio: how many calls to place per available agent
    const configuredRatio = campaign.predictive_ratio || 1.2;
    const maxAbandonRate = campaign.max_abandon_rate || 3; // 3%
    let pacingRatio = Math.min(configuredRatio, 1 / Math.max(connectRate, 0.1));
    // Reduce pacing if abandon rate exceeds max allowed
    if (abandonRate >= maxAbandonRate) {
      pacingRatio = Math.max(1, pacingRatio * 0.8); // dial down by 20%, minimum 1:1
    }

    // Target calls = available agents * pacing ratio - active calls
    const agentCount = availableAgents || 0;
    const activeCount = activeCalls || 0;
    const target = Math.max(0, Math.ceil(agentCount * pacingRatio) - activeCount);

    // Place calls if target > 0
    let placed = 0;
    const errors: string[] = [];

    if (target > 0) {
      // Get available agents with their user_ids
      const { data: agentSessions } = await sb
        .from("agent_sessions")
        .select("agent_id, status")
        .eq("campaign_id", campaignId)
        .in("status", ["available"])
        .limit(target);

      if (agentSessions && agentSessions.length > 0) {
        // For each available agent, get next lead and place call
        for (const session of agentSessions) {
          if (placed >= target) break;

          try {
            // Get next lead for this agent
            const { data: leadData, error: leadError } = await sb.rpc("get_next_lead_for_agent", {
              _agent_id: session.agent_id,
              _campaign_id: campaignId,
            });

            if (leadError || !leadData || leadData.length === 0) {
              continue; // No leads available for this agent
            }

            const lead = Array.isArray(leadData) ? leadData[0] : leadData;
            if (!lead || !lead.phone_e164) continue;

            // Place call via livekit-call-control edge function
            const callControlUrl = `${supabaseUrl}/functions/v1/livekit-call-control`;
            const callControlRes = await fetch(callControlUrl, {
              method: "POST",
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "dial",
                to: lead.phone_e164,
                contactId: lead.contact_id,
                campaignId: campaignId,
              }),
            });

            if (callControlRes.ok) {
              placed++;
            } else {
              const errorText = await callControlRes.text();
              errors.push(`Agent ${session.agent_id}: ${errorText}`);
            }
          } catch (e) {
            errors.push(`Agent ${session.agent_id}: ${(e as Error)?.message || "Unknown error"}`);
          }
        }
      }
    }

    return json({
      success: true,
      placed,
      target,
      available_agents: agentCount,
      active_calls: activeCount,
      pacing_ratio: Math.round(pacingRatio * 100) / 100,
      connect_rate: Math.round(connectRate * 1000) / 10,
      abandon_rate: abandonRate,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[predictive-dialer-engine] error:", err);
    return json({ error: (err as Error)?.message || "Internal error" }, 500);
  }
});
