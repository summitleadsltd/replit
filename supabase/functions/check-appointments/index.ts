// ═══════════════════════════════════════════════════════════
// supabase/functions/check-appointments/index.ts
// verify_jwt = TRUE
// Appointment overlap detection and day-prior confirmation queue
// Actions: check_overlap | get_pending_confirmations | notify_supervisor
// ═══════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_TIMEZONE = "America/New_York";

/** Returns a YYYY-MM-DD string in Eastern Time, offset by `offsetDays` from today. */
function appDateOffset(offsetDays: number): string {
  const now = new Date();
  const etNow = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const [y, m, d] = etNow.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return shifted.toISOString().slice(0, 10);
}

/** Returns { start, end } as UTC ISO strings for a given Eastern calendar day (YYYY-MM-DD). */
function etDayBoundsUtc(dateStr: string): { start: string; end: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Estimate using UTC-5 (EST), then correct for actual DST offset
  const naiveStart = new Date(Date.UTC(y, m - 1, d, 5, 0, 0));
  const naiveEnd   = new Date(Date.UTC(y, m - 1, d + 1, 5, 0, 0));
  const offsetStart = _etOffsetMs(naiveStart);
  const offsetEnd   = _etOffsetMs(naiveEnd);
  return {
    start: new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + offsetStart).toISOString(),
    end:   new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0) + offsetEnd).toISOString(),
  };
}

function _etOffsetMs(utcDate: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(utcDate);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  const localMs = Date.UTC(get("year"), get("month") - 1, get("day"),
    get("hour") === 24 ? 0 : get("hour"), get("minute"), get("second"));
  return utcDate.getTime() - localMs;
}

/** Current hour in Eastern Time (0-23). */
function etCurrentHour(): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, hour: "2-digit", hour12: false }).format(new Date()),
    10
  );
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

    // ── CHECK OVERLAP ─────────────────────────────────────────────
    if (action === "check_overlap") {
      const { technician_id, scheduled_at, duration_minutes } = body;

      if (!technician_id || !scheduled_at) {
        return json({ error: "technician_id and scheduled_at required" }, 400);
      }

      const { data, error } = await sb.rpc("check_technician_availability", {
        p_technician_id: technician_id,
        p_scheduled_at: scheduled_at,
        p_duration_minutes: duration_minutes || 60,
      });

      if (error) {
        return json({ error: "Overlap check failed", details: error.message }, 500);
      }

      const result = data?.[0];
      return json({
        success: true,
        is_available: result?.is_available ?? true,
        conflicts: result?.is_available ? [] : [{
          appointment_id: result?.conflicting_appointment_id,
          start: result?.conflicting_start,
          end: result?.conflicting_end,
        }],
      });
    }

    // ── GET PENDING CONFIRMATIONS ────────────────────────────────
    if (action === "get_pending_confirmations") {
      // "Tomorrow" in Eastern Time
      const tomorrowStr = appDateOffset(1);
      const { start: startOfDay, end: endOfDay } = etDayBoundsUtc(tomorrowStr);

      // Get user's company for filtering
      const { data: profile } = await sb
        .from("profiles")
        .select("company_id, language_skills")
        .eq("user_id", user.id)
        .single();

      let query = sb
        .from("appointments")
        .select(`
          id,
          contact_id,
          appointment_at,
          duration_minutes,
          confirmation_status,
          technician_id,
          agent_id,
          contacts!inner(first_name, last_name, phone_e164, language),
          technicians:technician_id(name),
          profiles:agent_id(display_name, email),
          call_attempts!left(id, notes, started_at, agent_id)
        `)
        .gte("appointment_at", startOfDay)
        .lte("appointment_at", endOfDay)
        .eq("confirmation_status", "pending")
        .order("appointment_at", { ascending: true });

      // Spanish agents only see Spanish-language leads
      if (profile?.language_skills?.includes("es") && !profile?.language_skills?.includes("en")) {
        query = query.eq("contacts.language", "es");
      }

      const { data, error } = await query;

      if (error) {
        return json({ error: "Failed to fetch confirmations", details: error.message }, 500);
      }

      // Transform and return
      const appointments = (data || []).map((a: any) => ({
        id: a.id,
        contact_id: a.contact_id,
        appointment_at: a.appointment_at,
        duration_minutes: a.duration_minutes,
        confirmation_status: a.confirmation_status,
        technician_id: a.technician_id,
        agent_id: a.agent_id,
        language: a.contacts?.language || "en",
        contact: {
          first_name: a.contacts?.first_name,
          last_name: a.contacts?.last_name,
          phone_e164: a.contacts?.phone_e164,
        },
        technician: a.technicians ? { name: a.technicians.name } : null,
        agent: a.profiles ? { display_name: a.profiles.display_name, email: a.profiles.email } : null,
        last_call_attempt: a.call_attempts?.[0] ? {
          id: a.call_attempts[0].id,
          notes: a.call_attempts[0].notes,
        } : null,
      }));

      return json({ success: true, appointments });
    }

    // ── NOTIFY SUPERVISOR (for pending confirmations at 6pm ET) ──
    if (action === "check_and_notify") {
      const tomorrowStr = appDateOffset(1);
      const { start: startOfDay, end: endOfDay } = etDayBoundsUtc(tomorrowStr);

      const { count, error } = await sb
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .gte("appointment_at", startOfDay)
        .lt("appointment_at", endOfDay)
        .eq("confirmation_status", "pending");

      if (error) {
        return json({ error: "Check failed", details: error.message }, 500);
      }

      // If pending > 0 and it's after 6pm Eastern, send notifications
      const isAfter6pm = etCurrentHour() >= 18;

      return json({
        success: true,
        pending_count: count || 0,
        is_after_6pm: isAfter6pm,
        notification_sent: isAfter6pm && (count || 0) > 0,
      });
    }

    // ── UPDATE CONFIRMATION STATUS ─────────────────────────────────
    if (action === "update_status") {
      const { appointment_id, status, call_attempt_id } = body;

      if (!appointment_id || !status) {
        return json({ error: "appointment_id and status required" }, 400);
      }

      const { error } = await sb
        .from("appointments")
        .update({
          confirmation_status: status,
          confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
          confirmed_by_agent_id: user.id,
        })
        .eq("id", appointment_id);

      if (error) {
        return json({ error: "Update failed", details: error.message }, 500);
      }

      // Log to call_attempts if provided
      if (call_attempt_id) {
        await sb.from("call_attempts").update({
          notes: `Confirmation call: ${status}`,
        }).eq("id", call_attempt_id);
      }

      return json({ success: true });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (err) {
    console.error("[check-appointments] Error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
