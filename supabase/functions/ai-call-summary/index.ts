import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT =
  "You are a call analysis assistant for a sales team. Analyse the following sales call transcript and return a JSON object with three fields: summary (a 2-3 sentence plain English summary of what happened on the call), sentiment (one of: positive, neutral, negative), and objections (an array of strings listing any objections the lead raised). Return only valid JSON, no other text.";

type CallAnalysis = {
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  objections: string[];
};

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function parseAnalysis(raw: string): CallAnalysis {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned);
  const sentiment = ["positive", "neutral", "negative"].includes(parsed?.sentiment)
    ? parsed.sentiment
    : "neutral";

  return {
    summary: typeof parsed?.summary === "string" ? parsed.summary : "",
    sentiment,
    objections: Array.isArray(parsed?.objections)
      ? parsed.objections.filter((item: unknown): item is string => typeof item === "string")
      : [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require an authenticated caller.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    // Detect service-role caller (e.g. from livekit-webhook) — skip user auth
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    let userId: string | null = null;
    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userErr } = await userClient.auth.getUser();
      if (userErr || !user) {
        return json({ error: "Unauthorized" }, 401);
      }
      userId = user.id;
    }

    const body = await req.json().catch(() => null);
    const callAttemptId: string | undefined = body?.callAttemptId ?? body?.call_attempt_id;
    let transcript: string | undefined = body?.transcript;

    if (!callAttemptId) {
      return json({ error: "callAttemptId is required" }, 400);
    }

    // Verify the caller is the agent for this call attempt OR an admin/manager.
    // Skip authorization for service-role callers (internal webhook triggers).
    if (!isServiceRole && userId) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: roles } = await userClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isPriv = (roles ?? []).some(
        (r: { role: string }) => r.role === "admin" || r.role === "manager",
      );
      if (!isPriv) {
        const { data: attempt, error: attemptErr } = await userClient
          .from("call_attempts")
          .select("agent_id")
          .eq("id", callAttemptId)
          .maybeSingle();
        if (attemptErr || !attempt || attempt.agent_id !== userId) {
          return json({ error: "Forbidden" }, 403);
        }
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    if (typeof transcript !== "string" || !transcript.trim()) {
      const { data: transcriptRow, error: transcriptErr } = await supabase
        .from("call_transcripts")
        .select("transcript_text, call_recordings!inner(call_attempt_id)")
        .eq("call_recordings.call_attempt_id", callAttemptId)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (transcriptErr) {
        console.error("[ai-call-summary] transcript lookup error:", transcriptErr.message);
        return json({ error: transcriptErr.message }, 500);
      }

      transcript = typeof transcriptRow?.transcript_text === "string"
        ? transcriptRow.transcript_text
        : undefined;
    }

    if (!transcript?.trim()) {
      return json({ error: "No transcript found for this call attempt" }, 400);
    }

    // Resolve LLM provider in priority order:
    //   1. OpenRouter (if OPENROUTER_API_KEY or `sk-or-` shaped OPENAI_API_KEY)
    //   2. OpenAI direct (real `sk-` OpenAI key)
    //   3. apifreellm fallback
    const openrouterKey =
      Deno.env.get("OPENROUTER_API_KEY") ??
      (Deno.env.get("OPENAI_API_KEY")?.startsWith("sk-or-")
        ? Deno.env.get("OPENAI_API_KEY")
        : undefined);
    const openrouterModel = Deno.env.get("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini";

    const openaiKey =
      !openrouterKey && Deno.env.get("OPENAI_API_KEY")?.startsWith("sk-")
        ? Deno.env.get("OPENAI_API_KEY")
        : undefined;
    const openaiModel = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

    const apiKey = Deno.env.get("API_FREE_LLM_API_KEY");
    const legacyModel = Deno.env.get("API_FREE_LLM_MODEL") ?? "default";
    if (!openrouterKey && !openaiKey && !apiKey) {
      return json({ error: "AI service not configured." }, 500);
    }

    let aiRes: Response;
    let summarySource: string;
    if (openrouterKey) {
      summarySource = "openrouter";
      aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": Deno.env.get("APP_URL") ?? "https://crm.summitleadsltd.com",
          "X-Title": "Summit Leads CRM",
        },
        body: JSON.stringify({
          model: openrouterModel,
          max_tokens: 800,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: transcript },
          ],
        }),
      });
    } else if (openaiKey) {
      summarySource = "openai";
      aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openaiModel,
          max_tokens: 800,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: transcript },
          ],
        }),
      });
    } else {
      summarySource = "api-free-llm";
      aiRes = await fetch("https://api.free-llm-api.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: legacyModel,
          max_tokens: 800,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: transcript },
          ],
        }),
      });
    }

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "Rate limits exceeded, please try again later." }, 429);
      const text = await aiRes.text();
      console.error("[ai-call-summary] AI provider error:", aiRes.status, text);
      return json({ error: "AI provider error", details: text }, aiRes.status >= 500 ? 502 : aiRes.status);
    }

    const aiData = await aiRes.json();
    const textBlock = typeof aiData?.choices?.[0]?.message?.content === "string"
      ? aiData.choices[0].message.content
      : null;
    let parsed: CallAnalysis;
    try {
      parsed = parseAnalysis(textBlock ?? "{}");
    } catch (parseErr) {
      console.error("[ai-call-summary] invalid AI JSON:", parseErr, textBlock);
      return json({ error: "AI response was not valid JSON" }, 502);
    }

    const { error: insertErr } = await supabase.from("ai_summaries").insert({
      call_attempt_id: callAttemptId,
      summary: parsed.summary ?? "",
      sentiment: parsed.sentiment ?? null,
      objections: parsed.objections ?? [],
      created_at: new Date().toISOString(),
      summary_source: summarySource,
      generation_status: "complete",
    });

    if (insertErr) {
      console.error("[ai-call-summary] insert error:", insertErr.message);
      return json({ error: insertErr.message }, 500);
    }

    return json({ ok: true, summary: parsed.summary, sentiment: parsed.sentiment, objections: parsed.objections });
  } catch (err) {
    console.error("[ai-call-summary] handler error:", err);
    return json({ error: (err as Error)?.message || "Internal error" }, 500);
  }
});
