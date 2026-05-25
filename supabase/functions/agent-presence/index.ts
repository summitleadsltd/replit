// ═══════════════════════════════════════════════════════════
// supabase/functions/agent-presence/index.ts
// verify_jwt = TRUE
// Agent heartbeat endpoint for presence tracking
// Actions: heartbeat | get_available_spanish_agents
// ═══════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const body: any = await req.json();
    const { action } = body;

    // ── HEARTBEAT ─────────────────────────────────────────────────
    if (action === "heartbeat") {
      const { status, current_call_attempt_id, current_room_name } = body;

      const { error } = await sb
        .from("agent_presence")
        .upsert({
          user_id: user.id,
          status: status || "available",
          last_heartbeat_at: new Date().toISOString(),
          current_call_attempt_id: current_call_attempt_id || null,
          current_room_name: current_room_name || null,
        }, { onConflict: "user_id" });

      if (error) {
        return json({ error: "Failed to update presence", details: error.message }, 500);
      }

      return json({ success: true });
    }

    // ── GET AVAILABLE SPANISH AGENTS ──────────────────────────────
    if (action === "get_available_spanish_agents") {
      // Get user's company
      const { data: profile } = await sb
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      const { data, error } = await sb.rpc("get_available_spanish_agents", {
        p_company_id: profile?.company_id || null,
      });

      if (error) {
        return json({ error: "Failed to fetch Spanish agents", details: error.message }, 500);
      }

      return json({ success: true, agents: data || [] });
    }

    // ── GET COMPANY PRESENCE ──────────────────────────────────────
    if (action === "get_company_presence") {
      const { data: profile } = await sb
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();

      let presenceQuery = sb
        .from("agent_presence")
        .select("user_id, status, last_heartbeat_at, current_call_attempt_id, current_room_name, profiles:user_id(display_name, email, company_id)")
        .gt("last_heartbeat_at", thirtySecondsAgo);

      // Only filter by company if the user has a company_id set
      if (profile?.company_id) {
        presenceQuery = presenceQuery.eq("profiles.company_id", profile.company_id);
      }

      const { data, error } = await presenceQuery;

      if (error) {
        return json({ error: "Failed to fetch presence", details: error.message }, 500);
      }

      const mapped = (data || []).map((p: any) => ({
        user_id: p.user_id,
        display_name: p.profiles?.display_name || null,
        email: p.profiles?.email || null,
        status: p.status,
        last_heartbeat_at: p.last_heartbeat_at,
        current_call_attempt_id: p.current_call_attempt_id,
        current_room_name: p.current_room_name,
      }));

      return json({ success: true, presence: mapped });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (err) {
    console.error("[agent-presence] Error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
