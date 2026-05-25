// ═══════════════════════════════════════════════════════════
// supabase/functions/livekit-webhook/index.ts
// verify_jwt = FALSE  (LiveKit calls this directly)
//
// Receives LiveKit webhook events (room, participant, egress).
// Updates call_sessions and triggers ai-call-summary on completion.
// ═══════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Webhook signature verification (HS256) ───────────────────
function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function verifyWebhookSignature(
  rawBody: string,
  authHeader: string,
  apiKey: string,
  apiSecret: string
): Promise<boolean> {
  if (!authHeader) return false;
  try {
    const parts = authHeader.split(".");
    if (parts.length !== 3) return false;

    // Verify the signature
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signedContent = `${parts[0]}.${parts[1]}`;
    const signature = base64urlDecode(parts[2]);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(signedContent)
    );
    if (!valid) return false;

    // Verify payload contains a sha256 of the body
    const payloadJson = new TextDecoder().decode(base64urlDecode(parts[1]));
    const payload = JSON.parse(payloadJson);

    // Verify issuer matches our api key
    if (payload.iss !== apiKey) return false;

    // Verify the body hash if present
    if (payload.sha256) {
      const bodyHash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(rawBody)
      );
      const hashHex = Array.from(new Uint8Array(bodyHash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (hashHex !== payload.sha256) return false;
    }

    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  // Always return 200 to prevent retries on handled events
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  const apiKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";

  const rawBody = await req.text();
  const authHeader = req.headers.get("Authorization") ?? "";

  // Verify webhook signature - fail closed if keys are missing
  if (!apiKey || !apiSecret) {
    console.error("LiveKit webhook verification failed: LIVEKIT_API_KEY or LIVEKIT_API_SECRET not configured");
    return new Response("Server configuration error", { status: 500 });
  }
  const valid = await verifyWebhookSignature(rawBody, authHeader, apiKey, apiSecret);
  if (!valid) {
    console.error("LiveKit webhook signature verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const event = JSON.parse(rawBody);
    const { event: eventType, room, participant, egress_info } = event;

    // Helper: find call_session by room name (stored in telnyx_call_leg_id)
    const findSession = async (roomName: string) => {
      const { data } = await sb
        .from("call_sessions")
        .select("id, agent_id, lead_id, campaign_id, recording_url, status")
        .eq("telnyx_call_leg_id", roomName)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    };

    // ── Participant events (SIP participant = the lead's phone leg) ──
    if (eventType === "participant_joined" && participant?.identity?.startsWith("sip_")) {
      const roomName = room?.name;
      if (roomName) {
        await sb.from("call_sessions").update({
          status: "answered",
          answered_at: new Date().toISOString(),
        }).eq("telnyx_call_leg_id", roomName);
      }
      return new Response("OK", { status: 200 });
    }

    if (eventType === "participant_left" && participant?.identity?.startsWith("sip_")) {
      const roomName = room?.name;
      if (roomName) {
        await sb.from("call_sessions").update({
          status: "completed",
          ended_at: new Date().toISOString(),
        }).eq("telnyx_call_leg_id", roomName);
      }
      return new Response("OK", { status: 200 });
    }

    // ── Room events ─────────────────────────────────────────────
    if (eventType === "room_finished") {
      const roomName = room?.name;
      if (roomName) {
        await sb.from("call_sessions").update({
          status: "completed",
          ended_at: new Date().toISOString(),
        }).eq("telnyx_call_leg_id", roomName).is("ended_at", null);
      }
      return new Response("OK", { status: 200 });
    }

    // ── Egress events (recording completed) ─────────────────────
    if (eventType === "egress_ended" && egress_info) {
      const roomName = egress_info.room_name;
      const fileResults = egress_info.file_results || [];
      const recordingUrl = fileResults[0]?.download_url || fileResults[0]?.filename || null;
      const durationSec = egress_info.duration ? Math.round(egress_info.duration / 1e9) : null;

      if (roomName) {
        // Update session with recording URL
        await sb.from("call_sessions").update({
          recording_url: recordingUrl,
          recording_status: "completed",
        }).eq("telnyx_call_leg_id", roomName);

        // Find the session to get agent/lead/campaign IDs
        const session = await findSession(roomName);
        if (session) {
          // Find the most recent call_attempt for this agent+lead to link the recording
          // Filter by both agent_id and contact_id to avoid linking to wrong call
          const { data: attempt } = await sb
            .from("call_attempts")
            .select("id")
            .eq("agent_id", session.agent_id)
            .eq("contact_id", session.lead_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Create call_recordings entry so Recordings page can find it
          const { error: recErr } = await sb.from("call_recordings").insert({
            call_session_id: session.id,
            call_attempt_id: attempt?.id || null,
            agent_id: session.agent_id,
            lead_id: session.lead_id,
            campaign_id: session.campaign_id,
            recording_url: recordingUrl,
            download_url: recordingUrl,
            duration_seconds: durationSec,
            format: "ogg",
            status: "completed",
          });
          if (recErr) console.error("[webhook] call_recordings insert error:", recErr.message);

          // Update the call_attempt with recording URL and duration
          if (attempt?.id && recordingUrl) {
            await sb.from("call_attempts").update({
              recording_url: recordingUrl,
              duration_seconds: durationSec,
            }).eq("id", attempt.id);

            // Write to webhook_events table (FIX 5)
            await sb.from("webhook_events").insert({
              source: "livekit",
              event_type: "egress_ended",
              call_attempt_id: attempt.id,
              payload: { recordingUrl, durationSec },
              created_at: new Date().toISOString(),
            });

            // Trigger AI call summary (FIX 5)
            try {
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-call-summary`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ callAttemptId: attempt.id }),
              });
              console.log("[webhook] Triggered AI summary for call attempt:", attempt.id);
            } catch (aiErr) {
              console.error("[webhook] Failed to trigger AI summary:", aiErr);
            }
          }
        }
      }
      return new Response("OK", { status: 200 });
    }

    // Unhandled event types — acknowledge anyway
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("LiveKit webhook error:", err);
    return new Response("OK", { status: 200 });
  }
});
