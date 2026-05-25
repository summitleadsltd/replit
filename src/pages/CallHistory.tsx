import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  Play,
  Square,
  Search,
  Download,
  Loader2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { ReportFilters, type DateRange, rangeFromPreset } from "@/components/reports/ReportFilters";
import { EmptyState } from "@/components/reports/EmptyState";
import { exportToCsv } from "@/lib/export-csv";
import { toast } from "@/hooks/use-toast";
import { formatEST, formatESTShort, formatESTTime } from "@/lib/timezone";

// ─── Types ──────────────────────────────────────────────────────────
interface CallRow {
  id: string;
  contact_id: string | null;
  agent_id: string | null;
  campaign_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  disposition: string | null;
  outcome: string | null;
  notes: string | null;
  created_at: string;
  contact_name: string;
  contact_phone: string | null;
  agent_name: string;
  campaign_name: string | null;
  recording_id: string | null;
  recording_url: string | null;
}

function fmtDuration(s: number | null | undefined): string {
  if (!s || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const dispositionColor: Record<string, string> = {
  appointment_booked: "bg-success/10 text-success border-success/30",
  not_interested: "bg-destructive/10 text-destructive border-destructive/30",
  callback_scheduled: "bg-info/10 text-info border-info/30",
  no_answer: "bg-muted text-muted-foreground",
  voicemail: "bg-muted text-muted-foreground",
  busy: "bg-warning/10 text-warning border-warning/30",
  wrong_number: "bg-destructive/10 text-destructive border-destructive/30",
  dnc: "bg-destructive/10 text-destructive border-destructive/30",
};

// ─── Component ──────────────────────────────────────────────────────
export default function CallHistory() {
  const { user, isAdmin, role } = useAuth();
  const isManager = isAdmin || role === "manager" || role === "team_leader";

  // Filters
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset(7));
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [agents, setAgents] = useState<{ user_id: string; display_name: string | null; email: string | null }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [selectedDispo, setSelectedDispo] = useState("all");
  const [search, setSearch] = useState("");

  // Data
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio playback
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Load reference data ──────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      supabase.from("campaigns").select("id, name").order("name"),
      isManager
        ? supabase.from("profiles").select("user_id, display_name, email").order("display_name")
        : Promise.resolve({ data: [] as any[], error: null }),
    ])
      .then(([camps, profs]) => {
        setCampaigns(camps.data || []);
        setAgents((profs.data || []) as any[]);
      })
      .catch(() => {});
  }, [isManager]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  // ── Fetch call history ───────────────────────────────────────────
  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const fromIso = new Date(range.from).toISOString();
      const toIso = new Date(new Date(range.to).setHours(23, 59, 59, 999)).toISOString();

      // Query call_attempts with joined contacts and campaigns
      let query = supabase
        .from("call_attempts")
        .select(
          "id, contact_id, agent_id, campaign_id, started_at, ended_at, duration_seconds, disposition, outcome, notes, created_at, call_recording_id, contacts(first_name, last_name, phone_e164), campaigns(name)"
        )
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(1000);

      // Agents only see their own calls
      if (!isManager && user) {
        query = query.eq("agent_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with agent names and recording URLs
      const agentIds = Array.from(new Set((data || []).map((c: any) => c.agent_id).filter(Boolean)));
      const recordingIds = Array.from(new Set((data || []).map((c: any) => c.call_recording_id).filter(Boolean)));

      const [profilesRes, recordingsRes] = await Promise.all([
        agentIds.length > 0
          ? supabase.from("profiles").select("user_id, display_name, email").in("user_id", agentIds)
          : Promise.resolve({ data: [] as any[] }),
        recordingIds.length > 0
          ? supabase.from("call_recordings").select("id, recording_url, download_url").in("id", recordingIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileMap = new Map<string, string>();
      for (const p of (profilesRes.data || []) as any[]) {
        profileMap.set(p.user_id, p.display_name || p.email || "Unknown");
      }
      const recordingMap = new Map<string, string>();
      for (const r of (recordingsRes.data || []) as any[]) {
        recordingMap.set(r.id, r.download_url || r.recording_url || "");
      }

      const rows: CallRow[] = (data || []).map((c: any) => {
        const contactName = c.contacts
          ? `${c.contacts.first_name || ""} ${c.contacts.last_name || ""}`.trim()
          : "Unknown";
        return {
          id: c.id,
          contact_id: c.contact_id,
          agent_id: c.agent_id,
          campaign_id: c.campaign_id,
          started_at: c.started_at,
          ended_at: c.ended_at,
          duration_seconds: c.duration_seconds,
          disposition: c.disposition,
          outcome: c.outcome,
          notes: c.notes,
          created_at: c.created_at,
          contact_name: contactName || "Unknown",
          contact_phone: c.contacts?.phone_e164 || null,
          agent_name: c.agent_id ? profileMap.get(c.agent_id) || "—" : "—",
          campaign_name: c.campaigns?.name || null,
          recording_id: c.call_recording_id || null,
          recording_url: c.call_recording_id ? recordingMap.get(c.call_recording_id) || null : null,
        };
      });

      setCalls(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load call history.";
      setErrorMessage(message);
      toast({ title: "Error loading call history", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [range, user, isManager]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // ── Disposition options ──────────────────────────────────────────
  const dispositionOptions = useMemo(() => {
    const set = new Set<string>();
    calls.forEach((c) => c.disposition && set.add(c.disposition));
    return Array.from(set).sort();
  }, [calls]);

  // ── Client-side filtering ────────────────────────────────────────
  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (selectedCampaign !== "all" && c.campaign_id !== selectedCampaign) return false;
      if (selectedAgent !== "all" && c.agent_id !== selectedAgent) return false;
      if (selectedDispo !== "all" && c.disposition !== selectedDispo) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !c.contact_name.toLowerCase().includes(s) &&
          !(c.contact_phone || "").toLowerCase().includes(s) &&
          !c.agent_name.toLowerCase().includes(s) &&
          !(c.campaign_name || "").toLowerCase().includes(s) &&
          !(c.notes || "").toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [calls, selectedCampaign, selectedAgent, selectedDispo, search]);

  // ── Audio playback ───────────────────────────────────────────────
  const handlePlay = async (call: CallRow) => {
    // Toggle stop
    if (playingId === call.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }

    if (!call.recording_id) {
      toast({ title: "No recording", description: "This call has no recording available.", variant: "destructive" });
      return;
    }

    audioRef.current?.pause();
    setLoadingAudioId(call.id);
    setPlayingId(call.id);

    try {
      // Use direct URL if we already have it, otherwise fetch via edge function
      let url = call.recording_url;
      if (!url) {
        const { data, error } = await supabase.functions.invoke("get-recording-url", {
          body: { call_recording_id: call.recording_id },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("Recording audio URL is not available yet.");
        url = data.url;
      }

      const audio = new Audio(url!);
      await audio.play();
      audio.onended = () => {
        setPlayingId(null);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPlayingId(null);
        audioRef.current = null;
        toast({ title: "Playback failed", variant: "destructive" });
      };
      audioRef.current = audio;
    } catch (err) {
      setPlayingId(null);
      const message = err instanceof Error ? err.message : "Could not play recording.";
      toast({ title: "Playback failed", description: message, variant: "destructive" });
    } finally {
      setLoadingAudioId(null);
    }
  };

  // ── CSV Export ───────────────────────────────────────────────────
  const handleExport = () => {
    exportToCsv(
      `call-history-${range.from.toISOString().slice(0, 10)}-to-${range.to.toISOString().slice(0, 10)}`,
      filtered.map((c) => ({
        date: c.created_at ? formatESTShort(c.created_at) : "",
        contact: c.contact_name,
        phone: c.contact_phone || "",
        agent: c.agent_name,
        campaign: c.campaign_name || "",
        disposition: c.disposition || "",
        outcome: c.outcome || "",
        duration: fmtDuration(c.duration_seconds),
        notes: c.notes || "",
        has_recording: c.recording_id ? "yes" : "no",
      })),
      [
        { key: "date", label: "Date (EST)" },
        { key: "contact", label: "Contact" },
        { key: "phone", label: "Phone" },
        { key: "agent", label: "Agent" },
        { key: "campaign", label: "Campaign" },
        { key: "disposition", label: "Disposition" },
        { key: "outcome", label: "Outcome" },
        { key: "duration", label: "Duration" },
        { key: "notes", label: "Notes" },
        { key: "has_recording", label: "Recording" },
      ],
    );
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isManager ? "Call History" : "My Call History"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isManager
            ? "Review all agent call activity, recordings, and dispositions"
            : "Review your call activity, recordings, and dispositions"}
          {" · "}All times shown in EST
        </p>
      </div>

      {/* Filters */}
      <ReportFilters
        range={range}
        onRangeChange={setRange}
        campaigns={campaigns}
        selectedCampaign={selectedCampaign}
        onCampaignChange={setSelectedCampaign}
        onExport={handleExport}
        exportLabel="Export CSV"
        rightSlot={
          <div className="flex items-center gap-2">
            {isManager && agents.length > 0 && (
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.user_id} value={a.user_id}>
                      {a.display_name || a.email || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {dispositionOptions.length > 0 && (
              <Select value={selectedDispo} onValueChange={setSelectedDispo}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="All dispositions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dispositions</SelectItem>
                  {dispositionOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, agent, campaign, notes..."
          className="pl-9"
        />
      </div>

      {/* Error state */}
      {errorMessage && (
        <Card className="border-destructive">
          <CardContent className="p-4 flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{errorMessage}</span>
            <Button size="sm" variant="outline" onClick={fetchCalls} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results count */}
      {!loading && !errorMessage && (
        <p className="text-sm text-muted-foreground">
          {filtered.length} call{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== calls.length && ` (filtered from ${calls.length})`}
        </p>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No calls found"
          description="Adjust your filters or date range to find calls."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((call) => (
            <Card
              key={call.id}
              className={`hover:border-primary/30 transition-colors ${
                playingId === call.id ? "border-primary/50 bg-primary/5" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Recording play button */}
                  <div className="shrink-0 pt-1">
                    {call.recording_id ? (
                      <Button
                        size="icon"
                        variant={playingId === call.id ? "default" : "outline"}
                        className="h-9 w-9"
                        onClick={() => handlePlay(call)}
                        disabled={loadingAudioId === call.id}
                      >
                        {loadingAudioId === call.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : playingId === call.id ? (
                          <Square className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                    ) : (
                      <div className="h-9 w-9 rounded-md border border-dashed border-muted-foreground/30 flex items-center justify-center">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Call details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">
                        {call.contact_name}
                      </span>
                      {call.contact_phone && (
                        <span className="text-xs text-muted-foreground">
                          {call.contact_phone}
                        </span>
                      )}
                      {call.disposition && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${dispositionColor[call.disposition] || ""}`}
                        >
                          {call.disposition.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {call.outcome && call.outcome !== "pending" && call.outcome !== call.disposition && (
                        <Badge variant="outline" className="text-xs">
                          {call.outcome.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatESTShort(call.created_at)}
                      </span>
                      {call.duration_seconds != null && call.duration_seconds > 0 && (
                        <span>{fmtDuration(call.duration_seconds)}</span>
                      )}
                      {isManager && (
                        <span className="font-medium">{call.agent_name}</span>
                      )}
                      {call.campaign_name && (
                        <span>{call.campaign_name}</span>
                      )}
                    </div>

                    {call.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 bg-muted/40 p-1.5 rounded">
                        {call.notes}
                      </p>
                    )}
                  </div>

                  {/* Duration badge */}
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-mono text-muted-foreground">
                      {fmtDuration(call.duration_seconds)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
