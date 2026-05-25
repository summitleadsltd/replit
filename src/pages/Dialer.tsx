import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logEvent } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Phone, PhoneOff, Clock, FileText, ChevronRight,
  SkipForward, Loader2, Wifi, WifiOff,
  AlertTriangle, Zap, StopCircle, Download,
  PhoneForwarded,
} from "lucide-react";
import { CalendarPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useDialerQueue } from "@/hooks/use-dialer-queue";
import { useAgentStatus, isCallableStatus, getStatusMeta } from "@/hooks/use-agent-status";
import { useLiveKitClient } from "@/hooks/use-livekit-client";
import { useCampaignPhones } from "@/hooks/use-campaign-phones";
import { AgentStatusSelector } from "@/components/agents/AgentStatusSelector";
import { formatPhoneDisplay } from "@/lib/phone";
import {
  buildQueueCsv,
  generateQueueFilename,
  downloadCsv,
} from "@/lib/export-queue-csv";
import LeadCard from "@/components/dialer/LeadCard";
import CallHistoryPanel from "@/components/dialer/CallHistoryPanel";
import CallTimeline from "@/components/dialer/CallTimeline";
import ScriptDrawer from "@/components/dialer/ScriptDrawer";
import ContactActivityTimeline from "@/components/dialer/ContactActivityTimeline";
import DispositionPanel from "@/components/dialer/DispositionPanel";

// Helper function to map disposition codes to outcome values
const dispositionToOutcome = (code: string): "appointment_booked" | "callback_scheduled" | "dnc_request" | "wrong_number" | "voicemail" | "no_answer" | "busy" | "not_interested" | "connected" => {
  const outcomeMap: Record<string, "appointment_booked" | "callback_scheduled" | "dnc_request" | "wrong_number" | "voicemail" | "no_answer" | "busy" | "not_interested" | "connected"> = {
    appointment_booked: "appointment_booked",
    callback: "callback_scheduled",
    dnc: "dnc_request",
    wrong_number: "wrong_number",
    voicemail: "voicemail",
    no_answer: "no_answer",
    busy: "busy",
    not_interested: "not_interested",
    connected: "connected",
    not_single_family: "not_interested",
    spanish: "not_interested",
    new_roof: "not_interested",
    already_customer: "connected",
  };
  return outcomeMap[code] ?? "no_answer";
};

import CallbackModal from "@/components/dialer/CallbackModal";
import AppointmentModal from "@/components/dialer/AppointmentModal";
import WrapUpModal from "@/components/dialer/WrapUpModal";
import TechnicianAppointmentModal from "@/components/technicians/TechnicianAppointmentModal";
import DialPad from "@/components/dialer/DialPad";
import AudioControls from "@/components/dialer/AudioControls";
import { RetryCountdown } from "@/components/dialer/RetryCountdown";
import { TransferPanel } from "@/components/dialer/TransferPanel";

type DialModeType = "click_to_call" | "power_dial" | "auto_dial";

export default function Dialer() {
  const { user, profile, refreshProfile, isAdmin, isAgent, isConfirmer } = useAuth();
  const { updateStatus } = useAgentStatus();
  const navigate = useNavigate();
  const prevAwaitingDispositionRef = useRef(false);

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; status: string; dial_mode: string | null }[]>([]);
  const [notes, setNotes] = useState("");
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showTechApptModal, setShowTechApptModal] = useState(false);
  const [pendingDisposition, setPendingDisposition] = useState<string | null>(null);
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [lastCallAttemptId, setLastCallAttemptId] = useState<string | null>(null);
  const [showTransferPanel, setShowTransferPanel] = useState(false);

  const [manualCallActive, setManualCallActive] = useState(false);
  const [manualDialedRaw, setManualDialedRaw] = useState("");
  const [manualDialedE164, setManualDialedE164] = useState("");
  const [manualMatchedContact, setManualMatchedContact] = useState<import("@/hooks/use-dialer-queue").QueueContact | null>(null);

  // Power dial state
  const [powerDialActive, setPowerDialActive] = useState(false);
  const [powerDialPaused, setPowerDialPaused] = useState(false);
  const [lastOutboundNumber, setLastOutboundNumber] = useState<string | null>(null);
  const powerDialRef = useRef(false);

  /** Flag: when true the next currentLead change should auto-dial. */
  const autoDialPendingRef = useRef(false);

  /** Prevent overlapping disposition saves. */
  const disposingRef = useRef(false);

  const agentStatus = profile?.agent_status || "offline";
  const agentReady = isCallableStatus(agentStatus);

  const selectedCampaign = campaigns.find((c) => c.id === campaignId);
  const campaignDialMode: DialModeType = (selectedCampaign?.dial_mode as DialModeType) || "click_to_call";
  const isPowerMode = campaignDialMode === "power_dial" || campaignDialMode === "auto_dial";

  const {
    currentLead,
    stats: queueStats,
    loading: queueLoading,
    fetchNextLead,
    disposeLead,
    skipLead,
    fetchQueueForExport,
  } = useDialerQueue(campaignId);

  const totalAssigned = queueStats.remaining + queueStats.completed;
  const contactedToday = queueStats.completed;
  const remainingToday = queueStats.remaining;

  // QueueContact from use-dialer-queue already has flat fields — pass through directly.
  const leadCard = currentLead ? { ...currentLead } as any : null;

  const { phones, getNextOutboundNumber, markUsed } = useCampaignPhones(campaignId);

  // ---------------------------------------------------------------------------
  // LiveKit WebRTC wiring (via useLiveKitClient hook).
  // ---------------------------------------------------------------------------
  const {
    isRegistered,
    isCallActive,
    callDuration,
    connectionStatus,
    callState: lkCallState,
    awaitingDisposition,
    callTimeline,
    callStartedAt,
    lastCallDuration,
    lastCallStartedAt,
    muted,
    held,
    errorMessage,
    dial,
    hangUp,
    toggleMute,
    toggleHold,
    sendDTMF,
    submitDisposition,
    diagLog,
    roomName: livekitRoomName,
    callControlId: livekitCallControlId,
  } = useLiveKitClient();

  // Track awaitingDisposition transitions (used below but no longer navigates away)
  useEffect(() => {
    prevAwaitingDispositionRef.current = awaitingDisposition;
  }, [awaitingDisposition]);

  // Convenience aliases — UI references these names in several places.
  const isConnected = isRegistered;
  const hangup = hangUp;
  const handleHangUp = hangUp;
  const makeCall = useCallback((n: string, from?: string) => {
    prevAwaitingDispositionRef.current = false;
    dial(n, from || lastOutboundNumber || "");
  }, [dial, lastOutboundNumber]);

  // Convenience aliases for the UI.
  const connectionState = connectionStatus as string;
  const clientReady = isRegistered;
  const callState = lkCallState;
  const onCall = lkCallState !== "idle";
  const canMakeCalls = isRegistered && agentReady && !onCall;

  // LiveKit client auto-connects on mount via useLiveKitClient internal useEffect

  // Load campaigns once
  useEffect(() => {
    supabase.from("campaigns").select("id, name, status, dial_mode")
      .in("status", ["active", "draft"]).order("name")
      .then(({ data }) => setCampaigns((data || []) as any[]));
  }, []);


  const activeContactId = currentLead?.contact_id || manualMatchedContact?.contact_id || null;

  const getOutboundCallerId = useCallback(async (): Promise<string | null> => {
    const poolNumber = await getNextOutboundNumber();
    if (poolNumber) {
      markUsed(poolNumber.caller_id);
      setLastOutboundNumber(poolNumber.phone_number);
      return poolNumber.phone_number;
    }
    setLastOutboundNumber(null);
    return null;
  }, [getNextOutboundNumber, markUsed]);

  // -----------------------------------------------------------------------
  // Auto-dial trigger: watches for currentLead changes when power dial is on
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!autoDialPendingRef.current || !currentLead || onCall || !clientReady) return;
    autoDialPendingRef.current = false;

    const phone = currentLead.phone_e164 || currentLead.phone_raw;
    if (!phone) {
      if (import.meta.env.DEV) console.log("[Dialer] ⚠️ Lead has no phone — skipping auto-dial");
      return;
    }

    const timer = setTimeout(async () => {
      if (onCall) return;
      if (import.meta.env.DEV) console.log(`[Dialer] ⚡ Auto-dialing ${currentLead.first_name} ${currentLead.last_name}`);
      const from = await getOutboundCallerId();
      makeCall(phone, from || undefined);
    }, 800);
    return () => clearTimeout(timer);
  }, [currentLead, onCall, clientReady, getOutboundCallerId, makeCall]);

  // -----------------------------------------------------------------------
  // Core handlers
  // -----------------------------------------------------------------------
  const handleLoadNext = useCallback(async () => {
    if (!agentReady) { toast({ title: "Not ready", description: "Set your status to Ready.", variant: "destructive" }); return; }
    await fetchNextLead();
    setNotes("");
  }, [fetchNextLead, agentReady]);

  /**
   * Export the current user's daily queue as CSV.
   * - Visible to: the assigned agent/confirmer themselves, or admins
   * - Uses same query logic as the dialer for consistent ordering
   * - Does NOT use recently-dialed exclusion (export is a snapshot)
   */
  const handleExportQueue = useCallback(async () => {
    if (!campaignId || !user) return;

    // Check permissions: agent/confirmer can export their own queue; admin can export any
    const canExport = isAdmin || isAgent || isConfirmer;
    if (!canExport) {
      toast({ title: "Not authorized", description: "Only agents and admins can export queues.", variant: "destructive" });
      return;
    }

    try {
      const leads = await fetchQueueForExport(500);
      if (leads.length === 0) {
        toast({ title: "Queue is empty", description: "No leads available to export for this campaign." });
        return;
      }

      const csv = buildQueueCsv(leads);
      const handle = profile?.display_name || profile?.email || user.id.slice(0, 8);
      const filename = generateQueueFilename(handle);
      downloadCsv(filename, csv);

      toast({ title: `Exported ${leads.length} leads`, description: `Queue saved to ${filename}` });

      // Audit log
      await logEvent({
        type: "queue.exported",
        entity_type: "campaign",
        entity_id: campaignId,
        metadata: { lead_count: leads.length, filename, user_id: user.id }
      });
    } catch (err) {
      if (import.meta.env.DEV) console.error("[Dialer] Export error:", err);
      toast({ title: "Export failed", description: "Failed to export queue. Try again.", variant: "destructive" });
    }
  }, [campaignId, user, isAdmin, isAgent, isConfirmer, profile, fetchQueueForExport]);

  const handleStartCall = useCallback(async () => {
    if (!leadCard) return;
    if (!agentReady) { toast({ title: "Not ready", variant: "destructive" }); return; }
    const phone = leadCard.phone_e164 || leadCard.phone_raw;
    if (!phone) { toast({ title: "No phone number", variant: "destructive" }); return; }
    const from = await getOutboundCallerId();
    makeCall(phone, from || undefined);
  }, [leadCard, agentReady, makeCall, getOutboundCallerId]);

  const handleManualDial = useCallback(async (e164: string, raw: string) => {
    if (!canMakeCalls) return;
    setManualCallActive(true);
    setManualDialedRaw(raw);
    setManualDialedE164(e164);
    try {
      const { data: matched } = await supabase
        .from("contacts").select("*").eq("phone_e164", e164).limit(1).maybeSingle();
      if (matched) {
        setManualMatchedContact({
          id: "", contact_id: matched.id, first_name: matched.first_name, last_name: matched.last_name,
          phone_e164: matched.phone_e164, phone_raw: matched.phone_raw, address: matched.address,
          city: matched.city, state: matched.state, zip_code: matched.zip_code, county: matched.county,
          title: matched.title, owner_renter: matched.owner_renter, home_value: matched.home_value,
          household_income: matched.household_income, credit_rating: matched.credit_rating,
          cool_notes: matched.cool_notes, timezone: matched.timezone, lead_status: matched.lead_status,
          attempts: 0, dial_status: null,
        });
      } else { setManualMatchedContact(null); }
    } catch { setManualMatchedContact(null); }
    const from = await getOutboundCallerId();
    makeCall(e164, from || undefined);
  }, [canMakeCalls, makeCall, getOutboundCallerId]);

  const handleEndCall = () => { hangup(); };

  const triggerAiSummary = useCallback((callLogId: string | null) => {
    if (!callLogId) return;
    supabase.functions.invoke("ai-call-summary", { body: { call_attempt_id: callLogId } }).catch(() => {});
  }, []);

  /**
   * Advance to next lead. If power dial is active, set the auto-dial flag
   * so the useEffect above triggers the call automatically.
   */
  const handleAdvanceNext = useCallback(async () => {
    if (powerDialRef.current && isPowerMode) {
      autoDialPendingRef.current = true;
    }
    await fetchNextLead();
    setNotes("");
  }, [fetchNextLead, isPowerMode]);

  const handleDispose = useCallback(async (code: string) => {
    if (disposingRef.current) return;
    disposingRef.current = true;

    try {
      if (currentLead) {
        // ── Queue lead disposition ──
        if (code === "callback") {
          disposingRef.current = false;
          setPendingDisposition(code);
          setShowCallbackModal(true);
          return;
        }
        if (code === "appointment_booked") {
          disposingRef.current = false;
          setPendingDisposition(code);
          setShowAppointmentModal(true);
          return;
        }

        // Save call log via queue hook (handles campaign_contact update + rescore)
        const callLogId = await disposeLead(code, notes, lastCallStartedAt, lastCallDuration || 0);
        toast({ title: "Disposition saved", description: `${currentLead.first_name || ""} ${currentLead.last_name || ""} — ${code.replace("_", " ")}` });
        triggerAiSummary(callLogId);

        // Audit log
        await logEvent({
          type: "call.disposition_saved",
          entity_type: "contact",
          entity_id: currentLead.contact_id,
          metadata: { call_attempt_id: callLogId, disposition: code, campaign_id: campaignId }
        });

        // Advance to next lead
        await handleAdvanceNext();
      } else if (manualCallActive) {
        // ── Manual call disposition ──
        const contactId = manualMatchedContact?.contact_id || null;
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id || null;

        const { data: callLogData } = await supabase.from("call_attempts").insert({
          contact_id: contactId,
          campaign_id: campaignId,
          agent_id: userId,
          disposition: code,
          notes: notes || null,
          started_at: lastCallStartedAt || new Date().toISOString(),
          ended_at: new Date().toISOString(),
          duration_seconds: lastCallDuration || 0,
          call_source: "manual",
          dial_mode_used: "manual",
          manual_dialed_e164: manualDialedE164 || null,
          manual_dialed_number: manualDialedRaw || null,
          outbound_number_used: lastOutboundNumber || null,
          outcome: dispositionToOutcome(code),
          provider_used: "livekit",
        }).select("id").single();

        const callLogId = callLogData?.id || null;
        const name = manualMatchedContact
          ? `${manualMatchedContact.first_name} ${manualMatchedContact.last_name}`
          : manualDialedRaw || "Unknown";
        toast({ title: "Disposition saved", description: `${name} — ${code.replace("_", " ")}` });
        triggerAiSummary(callLogId);

        // Audit log
        await logEvent({
          type: "call.disposition_saved",
          entity_type: "contact",
          entity_id: contactId,
          metadata: { call_attempt_id: callLogId, disposition: code, campaign_id: campaignId, source: "manual" }
        });

        // Reset manual call state
        setManualCallActive(false);
        setManualDialedRaw("");
        setManualDialedE164("");
        setManualMatchedContact(null);
      }
      setNotes("");
    } catch (err) {
      if (import.meta.env.DEV) console.error("[Dialer] Disposition error:", err);
      toast({ title: "Error saving disposition", variant: "destructive" });
    } finally {
      disposingRef.current = false;
    }
  }, [currentLead, manualCallActive, manualMatchedContact, manualDialedE164, manualDialedRaw, lastCallStartedAt, lastCallDuration, campaignId, notes, lastOutboundNumber, campaignDialMode, handleAdvanceNext, triggerAiSummary, disposeLead]);

  const handleModalSaved = useCallback(async () => {
    if (!currentLead || !pendingDisposition) return;
    setShowCallbackModal(false);
    setShowAppointmentModal(false);
    disposingRef.current = true;
    try {
      const callLogId = await disposeLead(pendingDisposition, notes, lastCallStartedAt, lastCallDuration || 0);
      setPendingDisposition(null);
      toast({ title: "Disposition saved" });
      triggerAiSummary(callLogId);

      await logEvent({
        type: "call.disposition_saved",
        entity_type: "contact",
        entity_id: currentLead.contact_id,
        metadata: { call_attempt_id: callLogId, disposition: pendingDisposition, campaign_id: campaignId }
      });

      await handleAdvanceNext();
    } finally {
      disposingRef.current = false;
    }
  }, [currentLead, pendingDisposition, notes, lastCallStartedAt, lastCallDuration, campaignId, handleAdvanceNext, triggerAiSummary, disposeLead]);

  const handleModalClose = useCallback(() => {
    setShowCallbackModal(false);
    setShowAppointmentModal(false);
    setPendingDisposition(null);
    disposingRef.current = false;
  }, []);

  const handleSkip = useCallback(async () => {
    hangup();
    setNotes("");
    if (powerDialRef.current && isPowerMode) {
      autoDialPendingRef.current = true;
    }
    await skipLead();
    await fetchNextLead();
  }, [hangup, isPowerMode, skipLead, fetchNextLead]);

  // Power dial controls
  const startPowerDial = useCallback(async () => {
    if (!agentReady || !clientReady) {
      toast({ title: "Cannot start", description: "Ensure status is Ready and telephony is connected.", variant: "destructive" });
      return;
    }
    powerDialRef.current = true;
    setPowerDialActive(true);
    setPowerDialPaused(false);
    autoDialPendingRef.current = true;
    toast({ title: "Power Dial started", description: "The system will automatically dial the next lead after each disposition." });
    setNotes("");
  }, [agentReady, clientReady]);

  const stopPowerDial = useCallback(() => {
    powerDialRef.current = false;
    autoDialPendingRef.current = false;
    setPowerDialActive(false);
    setPowerDialPaused(false);
    toast({ title: "Power Dial stopped" });
  }, []);

  // Stop power dial if agent goes non-ready
  useEffect(() => {
    if (powerDialActive && !agentReady && !onCall) {
      setPowerDialPaused(true);
      autoDialPendingRef.current = false;
    }
  }, [agentReady, powerDialActive, onCall]);

  const formatDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const formatTime = formatDuration;
  const statusMeta = getStatusMeta(agentStatus);
  const dialDisabledReason = !clientReady ? "LiveKit not connected" : !agentReady ? "Set status to Ready" : onCall ? "Call in progress" : undefined;

  return (
    <div className="animate-slide-in">
      {/* Required for inbound audio playback via LiveKit WebRTC — must not be muted or use display:none */}
      <audio id="remoteMedia" autoPlay playsInline muted={false} className="audio-hidden" />
      {/* DIAGNOSTIC PANEL — remove once audio is confirmed working */}
      {diagLog.length > 0 && (
        <div className="mb-4 p-3 rounded-md bg-black/80 border border-yellow-500/40 text-xs font-mono text-yellow-300 max-h-48 overflow-y-auto">
          <div className="text-yellow-500 font-bold mb-1">⚡ Call Diagnostics</div>
          {diagLog.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-header-title">Dialer</h1>
          <p className="page-header-subtitle">
            {campaignId ? "Dial through your campaign queue or manually" : "Select a campaign or dial manually"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {campaignId && (
            <Badge variant="outline" className={
              isPowerMode ? "text-warning border-warning/30" : "text-muted-foreground"
            }>
              {campaignDialMode === "power_dial" ? "⚡ Power Dial" : campaignDialMode === "auto_dial" ? "⚡ Auto Dial" : "📞 Click to Call"}
            </Badge>
          )}
          <AgentStatusSelector compact />
          <Badge variant="outline" className={
            isRegistered ? "text-success border-success/30" : "text-muted-foreground"
          }>
            {isRegistered ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {isRegistered ? "Connected" : "Not Connected"}
          </Badge>
        </div>
      </div>

      {!agentReady && !onCall && (
        <Alert className="mb-4 border-warning/30 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            You are currently <strong>{statusMeta.label}</strong>. Set your status to <strong>Ready</strong> to make calls.
          </AlertDescription>
        </Alert>
      )}
      {powerDialActive && powerDialPaused && (
        <Alert className="mb-4 border-warning/30 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            Power Dial is <strong>paused</strong> — agent status is not Ready. Set status to Ready to resume auto-dialing.
          </AlertDescription>
        </Alert>
      )}
      {connectionState === "not_configured" && (
        <Alert className="mb-4 border-warning/30 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">LiveKit is not configured yet. Please set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL in your environment.</AlertDescription>
        </Alert>
      )}
      {connectionState === "error" && errorMessage && (
        <Alert variant="destructive" className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertDescription>{errorMessage}</AlertDescription></Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Panel */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Campaign</CardTitle></CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <p className="text-muted-foreground text-sm">No campaigns available</p>
              ) : (
                <Select value={campaignId || "__none__"} onValueChange={(v) => {
                  setCampaignId(v === "__none__" ? null : v);
                  hangup(); setNotes(""); stopPowerDial();
                }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select campaign" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No campaign</SelectItem>
                    {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Assigned Today", value: totalAssigned },
              { label: "Contacted", value: contactedToday },
              { label: "Remaining", value: remainingToday },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                  <div className="text-lg font-semibold text-foreground mt-1">{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Queue Stats */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Queue Info</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Remaining Today</span><span className="font-medium text-foreground">{remainingToday}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Contacted</span><span className="font-medium text-foreground">{contactedToday}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Assigned</span><span className="font-medium text-foreground">{totalAssigned}</span></div>
              {phones.length > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Phone Pool</span><span className="font-medium text-foreground">{phones.filter(p => p.is_active).length} active</span></div>
              )}
              {lastOutboundNumber && (
                <div className="flex justify-between"><span className="text-muted-foreground">Caller ID</span><span className="font-mono text-xs text-foreground">{formatPhoneDisplay(lastOutboundNumber)}</span></div>
              )}
            </CardContent>
          </Card>

          {/* Export Queue — visible to agents/confirmers and admins */}
          {(isAdmin || isAgent || isConfirmer) && campaignId && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Download className="w-4 h-4" />Export</CardTitle></CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={handleExportQueue}
                  disabled={remainingToday === 0 || queueLoading}
                  title={remainingToday === 0 ? "Queue is empty" : "Download daily queue as CSV"}
                >
                  <Download className="w-4 h-4 mr-1" />
                  {remainingToday === 0 ? "Queue Empty" : "Export Queue (CSV)"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Power Dial Controls */}
          {isPowerMode && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-warning" />Power Dial</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {!powerDialActive ? (
                  <Button size="sm" className="w-full" onClick={startPowerDial} disabled={!canMakeCalls || remainingToday === 0}>
                    <Zap className="w-4 h-4 mr-1" /> Start Power Dial
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" className="w-full" onClick={stopPowerDial}>
                    <StopCircle className="w-4 h-4 mr-1" /> Stop Power Dial
                  </Button>
                )}
                {powerDialActive && (
                  <div className="text-xs text-center">
                    <Badge variant="outline" className={powerDialPaused ? "text-warning border-warning/30" : "text-success border-success/30"}>
                      {powerDialPaused ? "Paused" : "Active"}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {awaitingDisposition ? (
            <DispositionPanel
              disabled={false}
              onDispose={async (code) => {
                submitDisposition(code);
                await handleDispose(code);
              }}
            />
          ) : (
            <DialPad onDial={handleManualDial} disabled={!canMakeCalls} disabledReason={dialDisabledReason} onDtmf={sendDTMF} dtmfEnabled={isCallActive} />
          )}
        </div>

        {/* Center Panel */}
        <div className="lg:col-span-5 space-y-4">
          {manualCallActive ? (
            manualMatchedContact ? (
              <div className="space-y-2">
                <Badge variant="outline" className="text-primary border-primary/30">Manual Call — Matched Contact</Badge>
                <LeadCard lead={manualMatchedContact} />
              </div>
            ) : (
              <Card>
                <CardContent className="py-6 text-center space-y-2">
                  <Badge variant="outline" className="text-primary border-primary/30 mb-2">Manual Call</Badge>
                  <p className="text-lg font-mono text-foreground">{formatPhoneDisplay(manualDialedE164)}</p>
                  <p className="text-xs text-muted-foreground">No saved contact found</p>
                </CardContent>
              </Card>
            )
          ) : (
            leadCard ? (
              <LeadCard lead={leadCard} />
            ) : queueLoading ? (
              <LeadCard lead={null} />
            ) : (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-foreground">
                    Queue complete — no more leads assigned for today
                  </p>
                </CardContent>
              </Card>
            )
          )}

          <CallTimeline entries={callTimeline} />

          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-4">
                {!currentLead && !manualCallActive && !onCall ? (
                  <Button size="lg" variant="outline" onClick={handleLoadNext} disabled={queueLoading || !agentReady || remainingToday === 0}>
                    {queueLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ChevronRight className="w-5 h-5 mr-2" />}Next Lead
                  </Button>
                ) : onCall ? (
                  <div className="flex flex-col items-center gap-2">
                    {isCallActive && (
                      <span className="text-lg font-mono text-foreground">{formatDuration(callDuration)}</span>
                    )}
                    {lkCallState === "connecting" && (
                      <span className="text-sm text-muted-foreground animate-pulse">Connecting...</span>
                    )}
                    {lkCallState === "ringing" && (
                      <span className="text-sm text-muted-foreground animate-pulse">Ringing...</span>
                    )}
                    <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowTransferPanel(true)}
                      className="flex items-center gap-2"
                    >
                      <PhoneForwarded className="w-4 h-4" />
                      Transfer
                    </Button>
                    <Button size="lg" className="rounded-full w-16 h-16 bg-destructive hover:bg-destructive/90" onClick={() => hangUp()}>
                      <PhoneOff className="w-6 h-6" />
                    </Button>
                  </div>
                  </div>
                ) : (
                  <>
                    <Button size="lg" className="rounded-full w-16 h-16 bg-success hover:bg-success/90 text-success-foreground" onClick={handleStartCall} disabled={!isConnected || !leadCard || !agentReady}>
                      <Phone className="w-6 h-6" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleSkip}><SkipForward className="w-4 h-4 mr-1" />Skip</Button>
                  </>
                )}
              </div>
              {isCallActive && (
                <div className="flex items-center justify-center mt-4 gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-mono text-foreground">{formatDuration(callDuration)}</span>
                  {held && <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">ON HOLD</Badge>}
                  {muted && <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">MUTED</Badge>}
                  {powerDialActive && <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">⚡ POWER</Badge>}
                </div>
              )}
            </CardContent>
          </Card>

          <AudioControls muted={muted} held={held} onToggleMute={toggleMute} onToggleHold={toggleHold} callActive={callState === "active"} />
          {(currentLead || manualMatchedContact) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="default"
                className="w-full"
                onClick={() => setShowAppointmentModal(true)}
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                Add Appointment
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowTechApptModal(true)}
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                Schedule Technician
              </Button>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" />Notes</CardTitle></CardHeader>
            <CardContent>
              <textarea className="w-full h-24 bg-muted/50 border border-border rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                placeholder="Add call notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Contact Activity</CardTitle></CardHeader>
            <CardContent>
              <ContactActivityTimeline contactId={activeContactId} />
            </CardContent>
          </Card>

          <CallHistoryPanel contactId={activeContactId} />
        </div>
      </div>

      {showCallbackModal && currentLead && (
        <CallbackModal contactId={currentLead.contact_id} contactName={`${currentLead.first_name || ""} ${currentLead.last_name || ""}`}
          campaignId={campaignId} onClose={handleModalClose} onSaved={handleModalSaved} />
      )}
      {showAppointmentModal && (currentLead || manualMatchedContact) && (() => {
        const lead = currentLead || manualMatchedContact;
        if (!lead) return null;
        return (
          <AppointmentModal
            contactId={lead.contact_id}
            contactName={`${lead.first_name || ""} ${lead.last_name || ""}`}
            campaignId={campaignId}
            callAttemptId={lastCallAttemptId}
            contactAddress={lead.address}
            contactCity={lead.city}
            contactState={lead.state}
            contactZip={lead.zip_code}
            onClose={handleModalClose}
            onSaved={handleModalSaved}
          />
        );
      })()}
      {showTechApptModal && (currentLead || manualMatchedContact) && (() => {
        const lead = currentLead || manualMatchedContact;
        if (!lead) return null;
        const addr = [lead.address, lead.city, lead.state, lead.zip_code].filter(Boolean).join(", ");
        return (
          <TechnicianAppointmentModal
            open={showTechApptModal}
            onOpenChange={setShowTechApptModal}
            defaultContactId={lead.contact_id}
            defaultContactLabel={`${lead.first_name || ""} ${lead.last_name || ""}`.trim()}
            defaultLeadAddress={addr}
            defaultCampaignId={campaignId}
          />
        );
      })()}
      {showWrapUp && currentLead && (
        <WrapUpModal
          open={showWrapUp}
          contactId={currentLead.contact_id}
          contactName={`${currentLead.first_name || ""} ${currentLead.last_name || ""}`}
          contactAddress={currentLead.address || null}
          contactCity={currentLead.city || null}
          contactState={currentLead.state || null}
          contactZip={currentLead.zip_code || null}
          campaignId={campaignId}
          callAttemptId={lastCallAttemptId}
          callDuration={lastCallDuration}
          initialNotes={notes}
          onClose={() => setShowWrapUp(false)}
          onComplete={({ disposition, needsAppointmentModal, needsCallbackModal }) => {
            setShowWrapUp(false);
            if (needsAppointmentModal) { setPendingDisposition(disposition); setShowAppointmentModal(true); return; }
            if (needsCallbackModal) { setPendingDisposition(disposition); setShowCallbackModal(true); return; }
            handleDispose(disposition);
          }}
        />
      )}
      <ScriptDrawer
        campaignId={campaignId}
        firstName={
          currentLead?.first_name ||
          manualMatchedContact?.first_name ||
          null
        }
      />

      <TransferPanel
        isOpen={showTransferPanel}
        onClose={() => setShowTransferPanel(false)}
        roomName={livekitRoomName}
        callControlId={livekitCallControlId}
        currentLeadId={currentLead?.contact_id || null}
        callAttemptId={lastCallAttemptId}
        fromAgentId={user?.id || ""}
        onTransferComplete={() => {
          setShowTransferPanel(false);
          // Auto-advance to next lead after transfer
          handleAdvanceNext();
        }}
        onTransferFailed={() => {
          // Keep panel open to show error and flag option
        }}
      />
    </div>
  );
}
