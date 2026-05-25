// supabase/functions/call-monitor/index.ts
// verify_jwt = TRUE
// Actions: start | switch | end
// Allows a supervisor to monitor a live call via LiveKit room.
// Modes: listen (receive-only), whisper (talk to agent only), barge (talk to all).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface MonitorBody {
  action?: string;
  call_attempt_id?: string;
  session_id?: string;
  mode?: string;
}

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

    // Verify supervisor role
    const sb = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isSupervisor = (roles ?? []).some(
      (r: { role: string }) => ["admin", "manager", "team_leader"].includes(r.role)
    );
    if (!isSupervisor) return json({ error: "Only supervisors can monitor calls" }, 403);

    const body = (await req.json().catch(() => null)) as MonitorBody | null;
    const { action, call_attempt_id, session_id, mode } = body || {};

    if (action === "start") {
      if (!call_attempt_id) return json({ error: "call_attempt_id required" }, 400);
      if (!mode || !["listen", "whisper", "barge"].includes(mode)) {
        return json({ error: "mode must be listen, whisper, or barge" }, 400);
      }

      // Find the active call session for this attempt
      const { data: attempt } = await sb
        .from("call_attempts")
        .select("agent_id, call_session_id")
        .eq("id", call_attempt_id)
        .maybeSingle();

      if (!attempt?.agent_id) {
        return json({ error: "Call attempt not found" }, 404);
      }

      let sessionQuery = sb
        .from("call_sessions")
        .select("id, telnyx_call_leg_id, status")
        .in("status", ["initiated", "answered"]);

      // Prefer direct session association if available
      if (attempt.call_session_id) {
        sessionQuery = sessionQuery.eq("id", attempt.call_session_id);
      } else {
        sessionQuery = sessionQuery.eq("agent_id", attempt.agent_id);
      }

      const { data: session } = await sessionQuery
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session || !session.telnyx_call_leg_id) {
        return json({ error: "No active call session found for this call" }, 404);
      }

      // Generate a monitoring session ID
      const monitorSessionId = crypto.randomUUID();

      // Store monitoring session in database for persistence
      const { error: insertError } = await sb
        .from("call_monitor_sessions")
        .insert({
          id: monitorSessionId,
          supervisor_id: user.id,
          call_session_id: session.id,
          mode: mode,
          started_at: new Date().toISOString(),
        });
      
      if (insertError) {
        console.error("[call-monitor] Failed to store session:", insertError.message);
        return json({ error: "Failed to start monitoring session" }, 500);
      }

      return json({
        success: true,
        session_id: monitorSessionId,
        room_name: session.telnyx_call_leg_id,
        mode,
        message: `Monitoring started in ${mode} mode`,
      });
    }

    if (action === "switch") {
      if (!session_id || !mode) return json({ error: "session_id and mode required" }, 400);
      if (!["listen", "whisper", "barge"].includes(mode)) {
        return json({ error: "mode must be listen, whisper, or barge" }, 400);
      }
      
      // Update the monitoring session mode
      const { data: updateData, error: updateError } = await sb
        .from("call_monitor_sessions")
        .update({ mode: mode, switched_at: new Date().toISOString() })
        .eq("id", session_id)
        .eq("supervisor_id", user.id)
        .select();
      
      if (updateError) {
        console.error("[call-monitor] Failed to update mode:", updateError.message);
        return json({ error: "Failed to switch mode" }, 500);
      }
      
      if (!updateData || updateData.length === 0) {
        console.error("[call-monitor] Session not found or not owned by supervisor:", session_id);
        return json({ error: "Session not found or not authorized" }, 404);
      }
      
      return json({ success: true, session_id, mode, message: `Switched to ${mode} mode` });
    }

    if (action === "end") {
      if (!session_id) return json({ error: "session_id required" }, 400);
      
      // End the monitoring session
      const { data: updateData, error: updateError } = await sb
        .from("call_monitor_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", session_id)
        .eq("supervisor_id", user.id)
        .is("ended_at", null)
        .select();
      
      if (updateError) {
        console.error("[call-monitor] Failed to end session:", updateError.message);
        return json({ error: "Failed to end monitoring session" }, 500);
      }
      
      if (!updateData || updateData.length === 0) {
        console.error("[call-monitor] Session not found or already ended:", session_id);
        return json({ error: "Session not found or already ended" }, 404);
      }
      
      return json({ success: true, message: "Monitoring ended" });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("[call-monitor] error:", err);
    return json({ error: (err as Error)?.message || "Internal error" }, 500);
  }
});
