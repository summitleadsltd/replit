// ═══════════════════════════════════════════════════════════
// supabase/functions/livekit-call-control/index.ts
// verify_jwt = TRUE
// LiveKit + Telnyx SIP call control.
// Actions: dial | hangup | transfer | resolve-caller | register-session
// Uses LiveKit SIP API + Telnyx trunk for PSTN, LiveKit Egress for recording.
// ═══════════════════════════════════════════════════════════
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

// ── LiveKit HS256 JWT for server-to-server API calls ────────
function base64url(input: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < input.length; i += chunkSize) {
    binary += String.fromCharCode(...input.subarray(i, i + chunkSize));
  }
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function base64urlEncode(obj: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(obj)));
}
async function makeLiveKitJWT(
  apiKey: string,
  apiSecret: string,
  grants: Record<string, unknown> = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const claims = {
    iss: apiKey,
    iat: now,
    exp: now + 300,
    nbf: now,
    jti: crypto.randomUUID(),
    video: { roomCreate: true, roomList: true, roomAdmin: true, ...grants },
    sip: { admin: true, call: true },
  };
  const h = base64urlEncode(header);
  const p = base64urlEncode(claims);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${h}.${p}`)
  );
  return `${h}.${p}.${base64url(new Uint8Array(sig))}`;
}

// ── Phone helpers ────────────────────────────────────────────
function norm(v?: string | null) {
  if (!v) return "";
  const d = v.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length >= 10 && d.length <= 15) return `+${d}`;
  return "";
}

// ── UUID validation ─────────────────────────────────────────────
function isValidUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function area(v?: string | null) {
  const n = norm(v).replace(/\D/g, "");
  if (n.length === 11 && n.startsWith("1")) return n.slice(1, 4);
  if (n.length >= 10) return n.slice(0, 3);
  return null;
}

// ── resolveCallerNumber (caller ID pool selection) ───────────
async function resolveCaller(args: {
  sb: ReturnType<typeof createClient>;
  userId: string;
  campaignId: string | null;
  contactId: string | null;
  to: string;
  explicitFrom: string | null;
  fallbackFrom: string | null;
}) {
  const { sb, userId, campaignId, contactId, to, explicitFrom, fallbackFrom } =
    args;
  if (explicitFrom)
    return {
      callerId: norm(explicitFrom),
      selectionReason: "Explicit",
      numberId: null,
      source: "explicit",
    };

  const targetArea = area(to);
  let targetState = "",
    targetCity = "";
  if (contactId) {
    const { data: c } = await sb
      .from("contacts")
      .select("state,city")
      .eq("id", contactId)
      .maybeSingle();
    targetState = (c?.state ?? "").trim().toUpperCase();
    targetCity = (c?.city ?? "").trim().toUpperCase();
  }

  // Query the correct schema: caller_ids joined via campaign_caller_ids
  const { data: poolRaw, error: pe } = campaignId && isValidUuid(campaignId)
    ? await sb
        .from("campaign_caller_ids")
        .select("campaign_id, rotation_order, priority, caller_ids(id, phone_e164, is_active, last_used_at, area_code)")
        .eq("campaign_id", campaignId)
    : await sb
        .from("caller_ids")
        .select("id, phone_e164, is_active, last_used_at, area_code")
        .eq("is_active", true)
        .limit(20);
  if (pe) console.error("[resolveCaller] pool query failed:", pe.message || pe);

  type PoolEntry = {
    id: string; phone_e164: string; is_active: boolean;
    last_used_at: string | null; area_code: string | null; campaign_id?: string | null; score?: number;
  };
  const pool: PoolEntry[] = ((poolRaw ?? []) as any[]).map((row) => {
    const ci = row.caller_ids ?? row;
    return {
      id: ci.id ?? row.id, phone_e164: ci.phone_e164 ?? "",
      is_active: ci.is_active ?? true, last_used_at: ci.last_used_at ?? null,
      area_code: ci.area_code ?? null, campaign_id: row.campaign_id ?? null,
    };
  }).filter((n) => n.is_active && n.phone_e164);

  const cands = pool.map((n) => {
    let score = n.campaign_id === campaignId ? 20 : 10;
    const na = (n.area_code ?? "").trim();
    if (targetArea && na && na === targetArea) score += 100;
    if (!na) score += 5;
    return { ...n, score };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const la = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
    const lb = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
    return la - lb;
  });

  const sel = cands[0];
  if (sel) {
    await sb.from("caller_ids").update({ last_used_at: new Date().toISOString() }).eq("id", sel.id);
    return {
      callerId: norm(sel.phone_e164),
      selectionReason: `Selected ${sel.phone_e164}`,
      numberId: sel.id,
      source: "campaign_pool",
    };
  }
  if (fallbackFrom)
    return {
      callerId: norm(fallbackFrom),
      selectionReason: "Default caller ID",
      numberId: null,
      source: "default",
    };
  return {
    callerId: "",
    selectionReason: "No caller ID configured",
    numberId: null,
    source: "none",
  };
}

// ── LiveKit API helper ───────────────────────────────────────
async function livekitAPI(
  livekitUrl: string,
  path: string,
  method: string,
  jwt: string,
  body?: unknown
) {
  const httpUrl = livekitUrl.replace("wss://", "https://");
  const res = await fetch(`${httpUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {
    data: { user },
    error: ae,
  } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  if (ae || !user) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json();
    const { action } = body;

    const apiKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
    const livekitUrl = Deno.env.get("LIVEKIT_URL") ?? "";
    const sipTrunkId = Deno.env.get("TELNYX_SIP_TRUNK_ID") ?? "";

    // Get user's recording preference from app_settings (may not exist)
    let cfg: { enable_recording?: boolean } | null = null;
    try {
      const { data } = await sb
        .from("app_settings")
        .select("enable_recording")
        .eq("user_id", user.id)
        .maybeSingle();
      cfg = data;
    } catch { /* table may not exist */ }

    // resolve-caller needs no LiveKit config
    if (action === "resolve-caller") {
      const sel = await resolveCaller({
        sb,
        userId: user.id,
        campaignId: body.campaignId ?? null,
        contactId: body.contactId ?? null,
        to: body.to ?? "",
        explicitFrom: body.from ?? null,
        fallbackFrom: null,
      });
      if (!sel.callerId) return json({ error: sel.selectionReason }, 400);
      return json({ success: true, ...sel });
    }

    if (!apiKey || !apiSecret || !livekitUrl) {
      return json(
        { error: "LiveKit not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL in secrets." },
        400
      );
    }

    const jwt = await makeLiveKitJWT(apiKey, apiSecret);

    // ── DIAL ──────────────────────────────────────────────────────
    if (action === "dial") {
      const { to, from, contactId, campaignId } = body;
      const sel = await resolveCaller({
        sb,
        userId: user.id,
        campaignId: campaignId ?? null,
        contactId: contactId ?? null,
        to,
        explicitFrom: from ?? null,
        fallbackFrom: null,
      });
      if (!to || !sel.callerId)
        return json({ error: sel.selectionReason || "Missing to/callerId" }, 400);

      if (!sipTrunkId) {
        return json({ error: "TELNYX_SIP_TRUNK_ID not configured" }, 400);
      }

      // 1. Create a LiveKit room for this call
      const roomName = `call_${user.id.replace(/-/g, "")}_${Date.now()}`;
      const roomRes = await livekitAPI(livekitUrl, "/twirp/livekit.RoomService/CreateRoom", "POST", jwt, {
        name: roomName,
        empty_timeout: 300, // 5 min auto-cleanup if empty
        max_participants: 4,
      });
      if (!roomRes.ok)
        return json({ error: "Failed to create LiveKit room", details: roomRes.data }, 400);

      // 2. Create outbound SIP participant (call the lead's phone via Telnyx trunk)
      console.log("[dial] Creating SIP participant:", { sipTrunkId, to: norm(to), callerId: sel.callerId, roomName });
      const sipRes = await livekitAPI(
        livekitUrl,
        "/twirp/livekit.SIP/CreateSIPParticipant",
        "POST",
        jwt,
        {
          sip_trunk_id: sipTrunkId,
          sip_call_to: norm(to),
          room_name: roomName,
          participant_identity: `sip_${contactId || "lead"}_${Date.now()}`,
          participant_name: "Lead",
          // display_name sets the SIP From display name (caller ID name shown to recipient)
          display_name: sel.callerId || undefined,
          krisp_enabled: true,
          // Wait for lead to answer before the SIP participant is marked active.
          // Without this the participant joins immediately and the room auto-cleans
          // when Telnyx rejects or the call is not yet answered.
          wait_until_answered: true,
        }
      );
      console.log("[dial] SIP response:", sipRes.status, JSON.stringify(sipRes.data));
      if (!sipRes.ok) {
        const sipCode = sipRes.data?.sip_status_code ?? sipRes.data?.code ?? "unknown";
        const sipMsg = sipRes.data?.sip_status ?? sipRes.data?.message ?? JSON.stringify(sipRes.data);
        console.error("[dial] SIP call failed:", sipCode, sipMsg);
        return json({ error: `SIP call failed (${sipCode}): ${sipMsg}`, details: sipRes.data }, 400);
      }

      const sipParticipantId = sipRes.data?.participant_id || sipRes.data?.sip_call_id || roomName;

      // 3. Start Egress (recording) if enabled
      let egressId: string | null = null;
      if (cfg?.enable_recording) {
        const egressRes = await livekitAPI(
          livekitUrl,
          "/twirp/livekit.Egress/StartRoomCompositeEgress",
          "POST",
          jwt,
          {
            room_name: roomName,
            audio_only: true,
            file_outputs: [
              {
                file_type: "OGG",
                filepath: `recordings/${roomName}.ogg`,
              },
            ],
          }
        );
        if (egressRes.ok) {
          egressId = egressRes.data?.egress_id ?? null;
        } else {
          console.error("Egress start failed:", egressRes.data);
        }
      }

      // 4. Insert call_sessions record (non-fatal if it fails)
      // telnyx_call_control_id = SIP participant ID, telnyx_call_leg_id = room name (for webhook matching)
      let session = null;
      try {
        const { data: sess, error: se } = await sb
          .from("call_sessions")
          .insert({
            agent_id: user.id,
            lead_id: contactId || null,
            campaign_id: campaignId ?? null,
            telnyx_call_control_id: sipParticipantId,
            telnyx_call_leg_id: roomName,
            recording_id: egressId,
            direction: "outbound",
            from_number: sel.callerId,
            to_number: norm(to),
            status: "initiated",
          })
          .select()
          .single();
        if (se) console.error("[dial] call_sessions insert failed:", se.message);
        else session = sess;
      } catch (dbErr) {
        console.error("[dial] call_sessions insert exception:", dbErr);
      }

      return json({
        success: true,
        call: { call_control_id: sipParticipantId, room_name: roomName },
        session,
        selectedCallerId: sel.callerId,
        selectionReason: sel.selectionReason,
      });
    }

    // ── HANGUP ───────────────────────────────────────────────────
    if (action === "hangup") {
      const { callControlId, roomName } = body;
      if (!callControlId && !roomName)
        return json({ error: "callControlId or roomName required" }, 400);

      // Remove SIP participant
      if (callControlId) {
        await livekitAPI(
          livekitUrl,
          "/twirp/livekit.RoomService/RemoveParticipant",
          "POST",
          jwt,
          { room: roomName || "", identity: callControlId }
        );
      }

      // Delete room to clean up
      if (roomName) {
        await livekitAPI(
          livekitUrl,
          "/twirp/livekit.RoomService/DeleteRoom",
          "POST",
          jwt,
          { room: roomName }
        );
      }

      // Update call session
      if (callControlId) {
        await sb
          .from("call_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("telnyx_call_control_id", callControlId)
          .eq("agent_id", user.id);
      }

      return json({ success: true });
    }

    // ── TRANSFER ─────────────────────────────────────────────────
    if (action === "transfer") {
      const { callControlId, roomName, transferTo, warmTransfer, targetAgentId, context } = body;
      if (!roomName)
        return json({ error: "roomName required" }, 400);
      if (!sipTrunkId) {
        return json({ error: "TELNYX_SIP_TRUNK_ID not configured" }, 400);
      }

      // WARM TRANSFER: Originating agent stays connected, we invite Spanish agent to same room
      if (warmTransfer) {
        // Get target agent's profile for name display
        let targetName = "Spanish Agent";
        if (targetAgentId) {
          const { data: targetProfile } = await sb
            .from("profiles")
            .select("display_name")
            .eq("user_id", targetAgentId)
            .maybeSingle();
          targetName = targetProfile?.display_name || "Spanish Agent";
        }

        // Generate a token for the target agent to join the room
        const agentToken = await makeLiveKitJWT(apiKey, apiSecret, {
          room: roomName,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
        });

        // Update call session to transferring state
        if (callControlId) {
          await sb
            .from("call_sessions")
            .update({ 
              status: "transferring",
              transferred_to_agent_id: targetAgentId || null,
            })
            .eq("telnyx_call_control_id", callControlId)
            .eq("agent_id", user.id);
        }

        return json({ 
          success: true, 
          warmTransfer: true,
          roomName,
          agentWsUrl: livekitUrl,
          agentToken,
          targetName,
          context: context || null,
        });
      }

      // COLD TRANSFER: Traditional SIP transfer (if transferTo is a phone number)
      if (transferTo && transferTo !== "cold_handoff") {
        const sipRes = await livekitAPI(
          livekitUrl,
          "/twirp/livekit.SIP/CreateSIPParticipant",
          "POST",
          jwt,
          {
            sip_trunk_id: sipTrunkId,
            sip_call_to: norm(transferTo),
            room_name: roomName,
            participant_identity: `sip_transfer_${Date.now()}`,
            participant_name: "Transfer",
          }
        );
        if (!sipRes.ok)
          return json({ error: "Transfer failed", details: sipRes.data }, 400);
      }

      // COLD HANDOFF: Remove original agent from room
      if (callControlId) {
        await livekitAPI(
          livekitUrl,
          "/twirp/livekit.RoomService/RemoveParticipant",
          "POST",
          jwt,
          { room: roomName, identity: callControlId }
        );
        await sb
          .from("call_sessions")
          .update({ status: "transferred" })
          .eq("telnyx_call_control_id", callControlId)
          .eq("agent_id", user.id);
      }

      return json({ success: true, warmTransfer: false });
    }

    // ── REMOVE PARTICIPANT ───────────────────────────────────────
    if (action === "remove_participant") {
      const { roomName, identity } = body;
      if (!roomName || !identity)
        return json({ error: "roomName and identity required" }, 400);

      const res = await livekitAPI(
        livekitUrl,
        "/twirp/livekit.RoomService/RemoveParticipant",
        "POST",
        jwt,
        { room: roomName, identity }
      );

      if (!res.ok)
        return json({ error: "Failed to remove participant", details: res.data }, 400);

      return json({ success: true });
    }

    // ── REGISTER-SESSION ─────────────────────────────────────────
    if (action === "register-session") {
      const { callControlId, from, to, contactId, campaignId, status } = body;
      if (!callControlId)
        return json({ error: "callControlId required" }, 400);

      const { data: ex } = await sb
        .from("call_sessions")
        .select("id")
        .eq("telnyx_call_control_id", callControlId)
        .eq("agent_id", user.id)
        .maybeSingle();

      const pl = {
        agent_id: user.id,
        lead_id: contactId ?? null,
        campaign_id: campaignId ?? null,
        telnyx_call_control_id: callControlId,
        direction: "outbound",
        from_number: from ?? null,
        to_number: to ?? null,
        status: status ?? "initiated",
      };

      if (ex?.id) {
        const { data, error } = await sb
          .from("call_sessions")
          .update(pl)
          .eq("id", ex.id)
          .select()
          .single();
        if (error) throw error;
        return json({ success: true, session: data });
      }
      const { data, error } = await sb
        .from("call_sessions")
        .insert(pl)
        .select()
        .single();
      if (error) throw error;
      return json({ success: true, session: data });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (err) {
    console.error("[livekit-call-control] Unhandled error:", err);
    return json(
      { error: err instanceof Error ? err.message : "Internal error", details: String(err) },
      500
    );
  }
});
