// ═══════════════════════════════════════════════════════════
// supabase/functions/livekit-token/index.ts
// verify_jwt = TRUE
// Generates a LiveKit access token so the browser SDK can
// connect to a room as the authenticated agent.
// ═══════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// ── LiveKit JWT (HS256) ──────────────────────────────────────
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

async function createLiveKitToken(
  apiKey: string,
  apiSecret: string,
  identity: string,
  roomName?: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const claims: Record<string, unknown> = {
    iss: apiKey,
    sub: identity,
    iat: now,
    exp: now + 3600, // 1 hour
    nbf: now,
    jti: crypto.randomUUID(),
    video: {
      room: roomName || "",
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const h = base64urlEncode(header);
  const p = base64urlEncode(claims);
  const signingInput = new TextEncoder().encode(`${h}.${p}`);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, signingInput);
  const s = base64url(new Uint8Array(signature));

  return `${h}.${p}.${s}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  if (error || !user) return json({ error: "Unauthorized" }, 401);

  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  const livekitUrl = Deno.env.get("LIVEKIT_URL");

  if (!apiKey || !apiSecret || !livekitUrl) {
    return json({ error: "LiveKit not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL in secrets." }, 400);
  }

  // Parse optional room name from request body
  let roomName = "";
  try {
    const body = await req.json();
    roomName = body?.roomName || "";
  } catch {
    // No body is fine — token will have empty room (can join any room)
  }

  const identity = `agent_${user.id.replace(/-/g, "_")}`;
  const token = await createLiveKitToken(apiKey, apiSecret, identity, roomName);

  return json({ token, identity, wsUrl: livekitUrl });
});
