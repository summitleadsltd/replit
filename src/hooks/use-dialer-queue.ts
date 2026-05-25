import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rescoreSingleContact } from "@/lib/lead-scoring";
import type { QueueExportLead } from "@/lib/export-queue-csv";
import { appToday } from "@/lib/timezone";

export interface QueueContact {
  id: string; // campaign_contacts.id
  contact_id: string;
  first_name: string;
  last_name: string;
  phone_e164: string | null;
  phone_raw: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  county: string | null;
  title: string | null;
  owner_renter: string | null;
  home_value: string | null;
  household_income: string | null;
  credit_rating: string | null;
  cool_notes: string | null;
  timezone: string | null;
  lead_status: string | null;
  attempts: number;
  dial_status: string | null;
}

export interface QueueStats {
  remaining: number;
  completed: number;
  callbacks: number;
  deferred: number;
  nextRetryAt: string | null;
}

/** Dispositions that permanently remove a lead from the queue. */
const TERMINAL_DISPOSITIONS = [
  "wrong_number",
  "dnc",
  "not_interested",
  "appointment_booked",
  "not_single_family",
  "spanish",
  "new_roof",
];

/** Dispositions that defer the lead via retry delay (not terminal, not callback). */
const RETRY_DISPOSITIONS = ["no_answer", "voicemail", "busy"];

/** Max recently-dialed IDs to track for anti-recycling. */
const MAX_RECENT = 20;

export interface QueueFilter {
  /** Filter by contact language ('en', 'es', etc.) */
  language?: string;
  /** Filter by callback disposition for special routing */
  callbackDisposition?: string;
  /** Use daily_lead_assignments table instead of campaign_contacts */
  useDailyAssignments?: boolean;
  /** Agent ID for daily assignments lookup (defaults to current user) */
  agentId?: string;
}

export function useDialerQueue(campaignId: string | null, queueFilter?: QueueFilter) {
  const [currentLead, setCurrentLead] = useState<QueueContact | null>(null);
  const [stats, setStats] = useState<QueueStats>({ remaining: 0, completed: 0, callbacks: 0, deferred: 0, nextRetryAt: null });
  const [loading, setLoading] = useState(false);

  /** Track the last N campaign_contacts.ids we dialed to prevent recycling. */
  const recentlyDialedRef = useRef<string[]>([]);
  /** Track recent phone numbers too, so duplicate contacts sharing a number are not recycled. */
  const recentlyDialedPhonesRef = useRef<string[]>([]);
  /** Prefetched next lead ready to serve instantly (NOT locked in DB yet). */
  const prefetchedLeadRef = useRef<QueueContact | null>(null);
  /** Guard against overlapping fetchNextLead calls. */
  const fetchLockRef = useRef(false);
  /** The currently active lead ID — used to prevent prefetch from returning same lead. */
  const activeLeadIdRef = useRef<string | null>(null);

  const addToRecentlyDialed = useCallback((ccId: string) => {
    recentlyDialedRef.current = [ccId, ...recentlyDialedRef.current.filter(id => id !== ccId)].slice(0, MAX_RECENT);
  }, []);

  const normalizePhone = useCallback((phone: string | null | undefined) => {
    return phone?.replace(/[^\d+]/g, "") || null;
  }, []);

  const addPhoneToRecentlyDialed = useCallback((phone: string | null | undefined) => {
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    recentlyDialedPhonesRef.current = [
      normalized,
      ...recentlyDialedPhonesRef.current.filter((p) => p !== normalized),
    ].slice(0, MAX_RECENT);
  }, [normalizePhone]);

  const fetchStats = useCallback(async () => {
    if (!campaignId) {
      setStats({ remaining: 0, completed: 0, callbacks: 0, deferred: 0, nextRetryAt: null });
      return;
    }

    const now = new Date().toISOString();
    const { data: session } = await supabase.auth.getSession();
    const myUserId = session?.session?.user?.id || null;

    // Build base query for stats — filter by assigned_agent_id (mine or unassigned)
    let remainingQuery = supabase
      .from("campaign_contacts")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("dial_status", "pending");

    if (myUserId) {
      remainingQuery = remainingQuery.or(`assigned_agent_id.is.null,assigned_agent_id.eq.${myUserId}`);
    }
    
    // Apply language filter if specified
    if (queueFilter?.language) {
      remainingQuery = remainingQuery.eq("contact_language", queueFilter.language);
    }

    // Build completed query with same agent filter
    let completedQuery = supabase
      .from("campaign_contacts")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("dial_status", "completed");

    if (myUserId) {
      completedQuery = completedQuery.or(`assigned_agent_id.is.null,assigned_agent_id.eq.${myUserId}`);
    }

    // Build deferred query with same agent filter
    let deferredQuery = supabase
      .from("campaign_contacts")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("dial_status", "pending")
      .gt("next_eligible_at", now);

    if (myUserId) {
      deferredQuery = deferredQuery.or(`assigned_agent_id.is.null,assigned_agent_id.eq.${myUserId}`);
    }

    const [remainingRes, completedRes, callbackRes, deferredRes, soonestRes] = await Promise.all([
      remainingQuery
        .or(`next_eligible_at.is.null,next_eligible_at.lte.${now}`),
      completedQuery,
      supabase
        .from("callbacks")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "pending"),
      deferredQuery,
      supabase
        .from("campaign_contacts")
        .select("next_eligible_at")
        .eq("campaign_id", campaignId)
        .eq("dial_status", "pending")
        .gt("next_eligible_at", now)
        .order("next_eligible_at", { ascending: true })
        .limit(1),
    ]);

    setStats({
      remaining: remainingRes.count ?? 0,
      completed: completedRes.count ?? 0,
      callbacks: callbackRes.count ?? 0,
      deferred: deferredRes.count ?? 0,
      nextRetryAt: (soonestRes.data?.[0] as any)?.next_eligible_at ?? null,
    });
  }, [campaignId]);

  /**
   * Internal: resolve a single eligible lead from the DB.
   * Excludes recently dialed IDs and the currently active lead.
   * Optionally locks the lead as "dialing" in the DB.
   * Supports queueFilter for language-specific routing and daily assignments.
   */
  const resolveNextLead = useCallback(async (lockInDb: boolean): Promise<QueueContact | null> => {
    if (!campaignId) return null;

    const t0 = performance.now();
    const now = new Date().toISOString();

    // ── DAILY ASSIGNMENTS MODE ─────────────────────────────────
    // When useDailyAssignments is true, pull from daily_lead_assignments
    if (queueFilter?.useDailyAssignments) {
      const { data: session } = await supabase.auth.getSession();
      const myUserId = queueFilter.agentId || session?.session?.user?.id || null;
      const today = appToday(); // Eastern calendar day

      const { data: assignment, error: assignError } = await supabase
        .from("daily_lead_assignments")
        .select("id, contact_id, status, contacts!inner(id, first_name, last_name, phone_e164, phone_raw, address, city, state, zip_code, county, title, owner_renter, home_value, household_income, credit_rating, cool_notes, timezone, lead_status)")
        .eq("agent_id", myUserId)
        .eq("assigned_date", today)
        .eq("status", "pending")
        .eq("language", queueFilter.language || "en")
        .order("assigned_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (assignError) {
        if (import.meta.env.DEV) console.error("[Queue] Daily assignment query error:", assignError.message);
        return null;
      }

      if (!assignment) {
        if (import.meta.env.DEV) console.log("[Queue] No daily assignments remaining");
        return null;
      }

      const c = (assignment as any).contacts;
      const lead: QueueContact = {
        id: assignment.id,
        contact_id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        phone_e164: c.phone_e164,
        phone_raw: c.phone_raw,
        address: c.address,
        city: c.city,
        state: c.state,
        zip_code: c.zip_code,
        county: c.county,
        title: c.title,
        owner_renter: c.owner_renter,
        home_value: c.home_value,
        household_income: c.household_income,
        credit_rating: c.credit_rating,
        cool_notes: c.cool_notes,
        timezone: c.timezone,
        lead_status: c.lead_status,
        attempts: 0,
        dial_status: lockInDb ? "dialing" : "pending",
      };

      // Update assignment status if locking
      if (lockInDb) {
        await supabase
          .from("daily_lead_assignments")
          .update({ status: "contacted", locked_at: new Date().toISOString() })
          .eq("id", assignment.id);
      }

      const elapsed = (performance.now() - t0).toFixed(0);
      if (import.meta.env.DEV) console.log(`[Queue] ✅ Resolved daily assignment in ${elapsed}ms: ${lead.first_name} ${lead.last_name}`);

      return lead;
    }

    // ── STANDARD CAMPAIGN CONTACTS MODE ─────────────────────────
    const { data: session } = await supabase.auth.getSession();
    const myUserId = session?.session?.user?.id || null;
    // Combine recently dialed + currently active lead for exclusion
    const excludeIds = [...recentlyDialedRef.current];
    const excludePhones = new Set(recentlyDialedPhonesRef.current);
    if (activeLeadIdRef.current && !excludeIds.includes(activeLeadIdRef.current)) {
      excludeIds.push(activeLeadIdRef.current);
    }

    if (import.meta.env.DEV) console.log(`[Queue] 🔍 Resolving next lead (lock=${lockInDb}), campaign=${campaignId}, excluding=${excludeIds.length} IDs`);

    // Query candidates — uses idx_cc_queue_lookup partial index.
    // Pull a wider candidate window so suppression filters still leave us choices.
    let ccQuery = supabase
      .from("campaign_contacts")
      .select("id, contact_id, attempts, dial_status, contact_language, assigned_agent_id, contacts!inner(id, locked_to_agent_id, phone_e164, company_id)")
      .eq("campaign_id", campaignId)
      .eq("dial_status", "pending")
      .or(`next_eligible_at.is.null,next_eligible_at.lte.${now}`);

    // Only show leads assigned to me or unassigned (respects admin assignment)
    if (myUserId) {
      ccQuery = ccQuery.or(`assigned_agent_id.is.null,assigned_agent_id.eq.${myUserId}`);
    }
    
    // Apply language filter
    if (queueFilter?.language) {
      ccQuery = ccQuery.eq("contact_language", queueFilter.language);
    }
    
    // Apply callback disposition filter (for callback_spanish routing)
    if (queueFilter?.callbackDisposition) {
      ccQuery = ccQuery.filter("contacts.callback_disposition", "eq", queueFilter.callbackDisposition);
    }

    const { data: ccRows, error } = await ccQuery
      .order("priority_score", { ascending: false })
      .order("attempts", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      if (import.meta.env.DEV) console.error("[Queue] ❌ Query error:", error.message);
      return null;
    }

    if (!ccRows || ccRows.length === 0) {
      if (import.meta.env.DEV) console.log("[Queue] ℹ️ No eligible leads remaining");
      return null;
    }

    // ============== SUPPRESSION ==============
    // Build set of contact_ids whose phones are flagged DNC / wrong-number / voicemail-only.
    const candidateContactIds = ccRows.map((r: any) => r.contact_id);
    const [phoneFlagsRes, dncRes] = await Promise.all([
      supabase
        .from("contact_phone_numbers")
        .select("contact_id, phone_e164, is_dnc, is_wrong_number, is_voicemail_only")
        .in("contact_id", candidateContactIds),
      supabase
        .from("dnc_entries")
        .select("phone_e164, company_id"),
    ]);

    const suppressedContactIds = new Set<string>();
    const dncPhoneByCompany = new Map<string, Set<string>>(); // company_id|"global" -> phones
    for (const d of dncRes.data || []) {
      const key = d.company_id || "global";
      if (!dncPhoneByCompany.has(key)) dncPhoneByCompany.set(key, new Set());
      dncPhoneByCompany.get(key)!.add(d.phone_e164);
    }

    for (const pf of phoneFlagsRes.data || []) {
      if (pf.is_dnc || pf.is_wrong_number || pf.is_voicemail_only) {
        suppressedContactIds.add(pf.contact_id);
      }
    }
    for (const r of ccRows as any[]) {
      const phone = r.contacts?.phone_e164;
      const companyId = r.contacts?.company_id;
      if (!phone) continue;
      const globalDnc = dncPhoneByCompany.get("global");
      if (globalDnc?.has(phone)) suppressedContactIds.add(r.contact_id);
      if (companyId) {
        const companyDnc = dncPhoneByCompany.get(companyId);
        if (companyDnc?.has(phone)) suppressedContactIds.add(r.contact_id);
      }
    }

    // Filter out suppressed + recently dialed + locked-to-other-agent
    const filtered = (ccRows as any[]).filter((r) => {
      if (excludeIds.includes(r.id)) return false;
      const candidatePhone = normalizePhone(r.contacts?.phone_e164);
      if (candidatePhone && excludePhones.has(candidatePhone)) return false;
      if (suppressedContactIds.has(r.contact_id)) return false;
      const lockedTo = r.contacts?.locked_to_agent_id;
      if (lockedTo && myUserId && lockedTo !== myUserId) return false;
      return true;
    });

    // Prefer leads assigned/locked to me (ownership continuity), else fall back to unassigned
    const myAssigned = filtered.filter((r) => r.assigned_agent_id === myUserId || r.contacts?.locked_to_agent_id === myUserId);
    const pool = myAssigned.length > 0 ? myAssigned : filtered;
    const cc = pool[0] || null;

    if (!cc) return null;

    // Fetch contact details (+ lock if needed) in parallel
    const contactPromise = supabase.from("contacts").select("*").eq("id", cc.contact_id).single();
    let contact: any = null;
    
    if (lockInDb) {
      const lockPromise = supabase.from("campaign_contacts").update({
        dial_status: "dialing" as any,
        last_called_at: new Date().toISOString(),
      }).eq("id", cc.id);
      
      const [contactRes] = await Promise.all([contactPromise, lockPromise]);
      contact = contactRes.data;
    } else {
      const contactRes = await contactPromise;
      contact = contactRes.data;
    }

    if (!contact) {
      if (import.meta.env.DEV) console.warn("[Queue] ⚠️ Contact not found for cc.id", cc.id);
      return null;
    }

    const elapsed = (performance.now() - t0).toFixed(0);
    if (import.meta.env.DEV) console.log(`[Queue] ✅ Resolved lead in ${elapsed}ms: ${contact.first_name} ${contact.last_name} (cc.id=${cc.id}, attempts=${cc.attempts})`);

    return {
      id: cc.id,
      contact_id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      phone_e164: contact.phone_e164,
      phone_raw: contact.phone_raw,
      address: contact.address,
      city: contact.city,
      state: contact.state,
      zip_code: contact.zip_code,
      county: contact.county,
      title: contact.title,
      owner_renter: contact.owner_renter,
      home_value: contact.home_value,
      household_income: contact.household_income,
      credit_rating: contact.credit_rating,
      cool_notes: contact.cool_notes,
      timezone: contact.timezone,
      lead_status: contact.lead_status,
      attempts: cc.attempts ?? 0,
      dial_status: lockInDb ? "dialing" : "pending",
    };
  }, [campaignId, normalizePhone]);

  /**
   * Prefetch the next lead in the background (NO DB lock).
   * The lock is applied only when the lead is actually served.
   */
  const prefetch = useCallback(async () => {
    const lead = await resolveNextLead(false);
    if (lead) {
      prefetchedLeadRef.current = lead;
      if (import.meta.env.DEV) console.log(`[Queue] 📦 Prefetched next lead: ${lead.first_name} ${lead.last_name} (cc.id=${lead.id})`);
    }
  }, [resolveNextLead]);

  /**
   * Fetch the next eligible lead. Uses prefetch cache if available.
   * Serialized — overlapping calls are ignored.
   */
  const fetchNextLead = useCallback(async () => {
    if (!campaignId) return;
    if (fetchLockRef.current) {
      if (import.meta.env.DEV) console.log("[Queue] ⏳ fetchNextLead already in progress — skipping duplicate call");
      return;
    }

    fetchLockRef.current = true;
    setLoading(true);

    try {
      // Use prefetched lead if available
      const prefetched = prefetchedLeadRef.current;
      if (prefetched && !recentlyDialedRef.current.includes(prefetched.id)) {
        prefetchedLeadRef.current = null;

        // Verify it's still eligible AND lock it now
        const { data: check } = await supabase
          .from("campaign_contacts")
          .select("dial_status")
          .eq("id", prefetched.id)
          .single();

        if (check && check.dial_status === "pending") {
          // Lock it
          await supabase.from("campaign_contacts").update({
            dial_status: "dialing" as any,
            last_called_at: new Date().toISOString(),
          }).eq("id", prefetched.id);

          if (import.meta.env.DEV) console.log(`[Queue] ⚡ Using prefetched lead: ${prefetched.first_name} ${prefetched.last_name}`);
          prefetched.dial_status = "dialing";
          activeLeadIdRef.current = prefetched.id;
          setCurrentLead(prefetched);
          setLoading(false);
          fetchLockRef.current = false;
          // Non-blocking background tasks
          fetchStats().catch(() => {});
          prefetch().catch(() => {});
          return;
        }
        if (import.meta.env.DEV) console.log("[Queue] ⚠️ Prefetched lead is stale, fetching fresh");
      } else {
        prefetchedLeadRef.current = null;
      }

      const lead = await resolveNextLead(true);
      activeLeadIdRef.current = lead?.id || null;
      setCurrentLead(lead);
      await fetchStats();

      // Prefetch next lead in background
      if (lead) {
        prefetch().catch(() => {});
      }
    } finally {
      setLoading(false);
      fetchLockRef.current = false;
    }
  }, [campaignId, fetchStats, resolveNextLead, prefetch]);

  /**
   * Dispose the current lead: save call log, update state, compute retry.
   * Returns the call_attempt_id for AI summary generation.
   */
  const disposeLead = useCallback(
    async (dispositionCode: string, notes: string, callStartedAt?: string | null, callDurationSec?: number): Promise<string | null> => {
      if (!currentLead || !campaignId) return null;

      const t0 = performance.now();
      const prevLeadId = currentLead.id;

      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const endedAt = new Date().toISOString();
      const startedAt = callStartedAt || endedAt;

      // 1. Create call log
      const { data: callLogData } = await supabase.from("call_attempts").insert({
        contact_id: currentLead.contact_id,
        campaign_id: campaignId,
        agent_id: userId || null,
        disposition: dispositionCode,
        notes: notes || null,
        started_at: startedAt,
        ended_at: endedAt,
        duration_seconds: callDurationSec ?? 0,
        call_source: "queue",
        dial_mode_used: "queue",
        to_number: currentLead.phone_e164 || currentLead.phone_raw || null,
        outcome: dispositionCode === "appointment_booked" ? "appointment_booked" : dispositionCode === "callback" ? "callback_scheduled" : dispositionCode === "dnc" ? "dnc_request" : dispositionCode === "wrong_number" ? "wrong_number" : dispositionCode === "voicemail" ? "voicemail" : dispositionCode === "no_answer" ? "no_answer" : dispositionCode === "busy" ? "busy" : dispositionCode === "not_interested" ? "not_interested" : "connected",
        provider_used: "livekit",
      }).select("id").single();

      const callLogId = callLogData?.id || null;

      // 2. Determine new state
      const newAttempts = currentLead.attempts + 1;
      const isTerminal = TERMINAL_DISPOSITIONS.includes(dispositionCode);
      const isCallback = dispositionCode === "callback";
      const isRetryable = RETRY_DISPOSITIONS.includes(dispositionCode);

      // 3. Compute next_eligible_at for retryable dispositions
      let nextEligibleAt: string | null = null;

      if (isRetryable && !isTerminal) {
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("retry_delay_no_answer, retry_delay_voicemail, max_attempts")
          .eq("id", campaignId)
          .single();

        const maxAttempts = campaign?.max_attempts ?? 5;

        if (newAttempts >= maxAttempts) {
          if (import.meta.env.DEV) console.log(`[Queue] 🚫 Lead ${currentLead.id} reached max attempts (${maxAttempts}) — completing`);
        } else {
          let delaySeconds = 300;
          if (dispositionCode === "voicemail") {
            delaySeconds = campaign?.retry_delay_voicemail ?? 600;
          } else {
            delaySeconds = campaign?.retry_delay_no_answer ?? 300;
          }
          nextEligibleAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
          if (import.meta.env.DEV) console.log(`[Queue] ⏰ Lead ${currentLead.id} deferred until ${nextEligibleAt} (${delaySeconds}s, disposition: ${dispositionCode})`);
        }
      }

      // 4. Update campaign_contact
      const isMaxedOut = isRetryable && !isTerminal && !nextEligibleAt;
      const finalStatus = isTerminal || isMaxedOut ? "completed" : isCallback ? "completed" : "pending";

      const updatePayload: Record<string, any> = {
        dial_status: finalStatus,
        attempts: newAttempts,
        last_called_at: new Date().toISOString(),
        next_eligible_at: nextEligibleAt || null,
      };

      const { error: updateError } = await supabase
        .from("campaign_contacts")
        .update(updatePayload as any)
        .eq("id", currentLead.id);

      if (updateError) {
        if (import.meta.env.DEV) console.error("[Queue] ❌ Failed to update campaign_contact:", updateError.message);
      }

      // 5. Update contact lead_status
      const statusMap: Record<string, string> = {
        appointment_booked: "qualified",
        not_interested: "dead",
        dnc: "dead",
        wrong_number: "dead",
        not_single_family: "dead",
        spanish: "dead",
        new_roof: "dead",
      };
      const newLeadStatus = statusMap[dispositionCode] || "contacted";
      await supabase
        .from("contacts")
        .update({ lead_status: newLeadStatus as any })
        .eq("id", currentLead.contact_id);

      // 6. Rescore if still in queue (non-blocking)
      if (finalStatus === "pending" && campaignId) {
        rescoreSingleContact(currentLead.id, currentLead.contact_id, campaignId).catch(() => {});
      }

      // 7. Track this lead in recently-dialed to prevent recycling
      addToRecentlyDialed(prevLeadId);
      addPhoneToRecentlyDialed(currentLead.phone_e164 || currentLead.phone_raw);

      // 8. Clear current lead immediately
      activeLeadIdRef.current = null;
      setCurrentLead(null);

      // 9. Invalidate prefetch if it matches this lead
      if (prefetchedLeadRef.current?.id === prevLeadId) {
        prefetchedLeadRef.current = null;
      }

      const elapsed = (performance.now() - t0).toFixed(0);
      if (import.meta.env.DEV) console.log(`[Queue] 📋 Disposed lead ${prevLeadId} in ${elapsed}ms: disposition=${dispositionCode}, status=${finalStatus}, attempts=${newAttempts}`);

      return callLogId;
    },
    [currentLead, campaignId, addToRecentlyDialed, addPhoneToRecentlyDialed]
  );

  const skipLead = useCallback(async () => {
    if (!currentLead) return;

    addToRecentlyDialed(currentLead.id);
    addPhoneToRecentlyDialed(currentLead.phone_e164 || currentLead.phone_raw);

    await supabase
      .from("campaign_contacts")
      .update({ dial_status: "pending" as any })
      .eq("id", currentLead.id);

    if (import.meta.env.DEV) console.log(`[Queue] ⏭️ Skipped lead ${currentLead.id}`);

    activeLeadIdRef.current = null;
    setCurrentLead(null);
    await fetchStats();
  }, [currentLead, fetchStats, addToRecentlyDialed, addPhoneToRecentlyDialed]);

  // Release stale dialing locks on campaign init
  useEffect(() => {
    if (!campaignId) return;
    const release = async () => {
      try {
        const { data } = await supabase.rpc("release_stale_dialing_locks" as any);
        if (data && (data as number) > 0) {
          if (import.meta.env.DEV) console.log(`[Queue] 🔓 Released ${data} stale dialing locks`);
        }
      } catch { /* ignore */ }
    };
    release();
  }, [campaignId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Clear state when campaign changes
  useEffect(() => {
    recentlyDialedRef.current = [];
    recentlyDialedPhonesRef.current = [];
    prefetchedLeadRef.current = null;
    activeLeadIdRef.current = null;
    fetchLockRef.current = false;
    setCurrentLead(null);
  }, [campaignId]);

  /**
   * Fetch all eligible leads in queue order for CSV export.
   * Uses the same ordering and eligibility rules as the dialer,
   * but returns all matching leads (not just the first one).
   * Does NOT apply recently-dialed exclusion (export is a snapshot).
   * Respects RLS: returns leads the current user has access to view.
   */
  const fetchQueueForExport = useCallback(async (
    limit: number = 500
  ): Promise<QueueExportLead[]> => {
    if (!campaignId) return [];

    const now = new Date().toISOString();

    // Query candidates using same ordering as resolveNextLead
    const { data: ccRows, error } = await supabase
      .from("campaign_contacts")
      .select("id, contact_id, attempts, dial_status, priority_score, assigned_agent_id, contacts!inner(id, locked_to_agent_id, phone_e164, company_id, first_name, last_name, email, city, state, zip_code, cool_notes, lead_source, lead_status, updated_at)")
      .eq("campaign_id", campaignId)
      .eq("dial_status", "pending")
      .or(`next_eligible_at.is.null,next_eligible_at.lte.${now}`)
      .order("priority_score", { ascending: false })
      .order("attempts", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      if (import.meta.env.DEV) console.error("[Queue] Export query error:", error.message);
      return [];
    }

    if (!ccRows || ccRows.length === 0) return [];

    // ============== SUPPRESSION (same as resolveNextLead) ==============
    const candidateContactIds = ccRows.map((r: any) => r.contact_id);
    const [phoneFlagsRes, dncRes] = await Promise.all([
      supabase
        .from("contact_phone_numbers")
        .select("contact_id, phone_e164, is_dnc, is_wrong_number, is_voicemail_only")
        .in("contact_id", candidateContactIds),
      supabase
        .from("dnc_entries")
        .select("phone_e164, company_id"),
    ]);

    const suppressedContactIds = new Set<string>();
    const dncPhoneByCompany = new Map<string, Set<string>>();
    for (const d of dncRes.data || []) {
      const key = d.company_id || "global";
      if (!dncPhoneByCompany.has(key)) dncPhoneByCompany.set(key, new Set());
      dncPhoneByCompany.get(key)!.add(d.phone_e164);
    }

    for (const pf of phoneFlagsRes.data || []) {
      if (pf.is_dnc || pf.is_wrong_number || pf.is_voicemail_only) {
        suppressedContactIds.add(pf.contact_id);
      }
    }
    for (const r of ccRows as any[]) {
      const phone = r.contacts?.phone_e164;
      const companyId = r.contacts?.company_id;
      if (!phone) continue;
      const globalDnc = dncPhoneByCompany.get("global");
      if (globalDnc?.has(phone)) suppressedContactIds.add(r.contact_id);
      if (companyId) {
        const companyDnc = dncPhoneByCompany.get(companyId);
        if (companyDnc?.has(phone)) suppressedContactIds.add(r.contact_id);
      }
    }

    // Filter out suppressed (but NOT recently-dialed, since export is a snapshot)
    const filtered = (ccRows as any[]).filter((r) => {
      if (suppressedContactIds.has(r.contact_id)) return false;
      return true;
    });

    // Map to export format
    return filtered.map((r: any) => {
      const c = r.contacts;
      return {
        lead_id: r.contact_id,
        first_name: c?.first_name || null,
        last_name: c?.last_name || null,
        phone: c?.phone_e164 || null,
        secondary_phone: null, // Could fetch from contact_phone_numbers if needed
        email: c?.email || null,
        company: null, // Could fetch company name if needed
        city: c?.city || null,
        state: c?.state || null,
        zip: c?.zip_code || null,
        source: c?.lead_source || null,
        disposition: c?.lead_status || null,
        priority_score: r.priority_score || null,
        assigned_to: r.assigned_agent_id || null,
        last_contacted_at: c?.updated_at || null,
        notes: c?.cool_notes || null,
      };
    });
  }, [campaignId]);

  return {
    currentLead,
    stats,
    loading,
    fetchNextLead,
    disposeLead,
    skipLead,
    fetchStats,
    fetchQueueForExport,
  };
}
