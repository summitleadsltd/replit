// supabase/functions/get-recording-url/index.ts
// verify_jwt = TRUE
// Returns the audio URL for a call recording.
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is authenticated
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const recordingId = body?.call_recording_id;
    if (!recordingId) return json({ error: "call_recording_id is required" }, 400);

    // Use authenticated user client to enforce RLS for access control
    const { data: rec, error: recErr } = await userClient
      .from("call_recordings")
      .select("id, recording_url, download_url, status, agent_id")
      .eq("id", recordingId)
      .maybeSingle();

    if (recErr) return json({ error: recErr.message }, 500);
    if (!rec) return json({ error: "Recording not found" }, 404);

    const url = rec.download_url || rec.recording_url;
    if (!url) return json({ error: "Recording audio URL is not available yet." }, 404);

    return json({ url, status: rec.status });
  } catch (err) {
    console.error("[get-recording-url] error:", err);
    return json({ error: (err as Error)?.message || "Internal error" }, 500);
  }
});
