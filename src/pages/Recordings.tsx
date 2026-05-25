import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Disc3, Play, Download, Square, Search, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toESTDate } from "@/lib/timezone";
import { ReportFilters, type DateRange, rangeFromPreset } from "@/components/reports/ReportFilters";
import { EmptyState } from "@/components/reports/EmptyState";
import { exportToCsv } from "@/lib/export-csv";
import { toast } from "@/hooks/use-toast";

interface RecordingRow {
  id: string;
  duration_seconds: number | null;
  format: string | null;
  created_at: string;
  call_attempt_id: string | null;
  has_audio: boolean;
  audio_url: string | null;
  contact_name: string;
  agent_name: string;
  disposition: string | null;
  outcome: string | null;
  campaign_name: string | null;
  campaign_id: string | null;
  agent_id: string | null;
}

function fmtDuration(s: number | null) {
  if (!s) return "0:00";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function Recordings() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset(30));
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [agents, setAgents] = useState<{ user_id: string; display_name: string | null; email: string | null }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [selectedDispo, setSelectedDispo] = useState("all");
  const [search, setSearch] = useState("");

  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reference data
  useEffect(() => {
    Promise.all([
      supabase.from("campaigns").select("id, name").order("name"),
      supabase.from("profiles").select("user_id, display_name, email").order("display_name"),
    ])
      .then(([camps, profs]) => {
        if (camps.error) throw camps.error;
        if (profs.error) throw profs.error;
        setCampaigns(camps.data || []);
        setAgents(profs.data || []);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to load recording filters.";
        toast({ title: "Could not load filters", description: message, variant: "destructive" });
      });
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  // Fetch recordings
  useEffect(() => {
    const fromIso = new Date(range.from).toISOString();
    const toIso = new Date(new Date(range.to).setHours(23, 59, 59, 999)).toISOString();

    const fetchRecordings = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const { data: simpleData, error: simpleError } = await supabase
          .from("call_recordings")
          .select("id, duration_seconds, format, created_at, call_attempt_id, recording_url, download_url, agent_id, campaign_id")
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: false })
          .limit(500);
        
        if (simpleError) throw simpleError;

        // Enrich with call attempt data (contact name, disposition, outcome)
        const attemptIds = (simpleData || []).map((r: any) => r.call_attempt_id).filter(Boolean);
        const agentIds = Array.from(new Set((simpleData || []).map((r: any) => r.agent_id).filter(Boolean)));
        const campaignIds = Array.from(new Set((simpleData || []).map((r: any) => r.campaign_id).filter(Boolean)));

        const [attemptsRes, profilesRes, campaignsRes] = await Promise.all([
          attemptIds.length > 0
            ? supabase.from("call_attempts").select("id, disposition, outcome, contact_id, contacts(first_name, last_name)").in("id", attemptIds)
            : Promise.resolve({ data: [] as any[], error: null }),
          agentIds.length > 0
            ? supabase.from("profiles").select("user_id, display_name, email").in("user_id", agentIds)
            : Promise.resolve({ data: [] as any[], error: null }),
          campaignIds.length > 0
            ? supabase.from("campaigns").select("id, name").in("id", campaignIds)
            : Promise.resolve({ data: [] as any[], error: null }),
        ]);

        const attemptMap = new Map<string, any>();
        for (const a of (attemptsRes.data || []) as any[]) { attemptMap.set(a.id, a); }
        const profileMap = new Map<string, string>();
        for (const p of (profilesRes.data || []) as any[]) { profileMap.set(p.user_id, p.display_name || p.email || "Unknown"); }
        const campaignMap = new Map<string, string>();
        for (const c of (campaignsRes.data || []) as any[]) { campaignMap.set(c.id, c.name); }

        const rows: RecordingRow[] = (simpleData || []).map((r: any) => {
          const attempt = r.call_attempt_id ? attemptMap.get(r.call_attempt_id) : null;
          const contactName = attempt?.contacts
            ? `${attempt.contacts.first_name || ""} ${attempt.contacts.last_name || ""}`.trim()
            : "Unknown";
          return {
            id: r.id,
            duration_seconds: r.duration_seconds,
            format: r.format,
            created_at: r.created_at,
            call_attempt_id: r.call_attempt_id,
            audio_url: r.download_url || r.recording_url || null,
            has_audio: Boolean(r.download_url || r.recording_url),
            contact_name: contactName || "Unknown",
            agent_name: r.agent_id ? profileMap.get(r.agent_id) || "—" : "—",
            disposition: attempt?.disposition || null,
            outcome: attempt?.outcome || null,
            campaign_name: r.campaign_id ? campaignMap.get(r.campaign_id) || null : null,
            campaign_id: r.campaign_id || null,
            agent_id: r.agent_id || null,
          };
        });
        setRecordings(rows);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load recordings.";
        setErrorMessage(message);
        toast({ title: "Could not load recordings", description: message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchRecordings();
  }, [range]);

  // Available dispositions in this dataset
  const dispositionOptions = useMemo(() => {
    const set = new Set<string>();
    recordings.forEach((r) => r.disposition && set.add(r.disposition));
    return Array.from(set).sort();
  }, [recordings]);

  // Apply client-side filters
  const filtered = useMemo(() => {
    return recordings.filter((r) => {
      if (selectedCampaign !== "all" && r.campaign_id !== selectedCampaign) return false;
      if (selectedAgent !== "all" && r.agent_id !== selectedAgent) return false;
      if (selectedDispo !== "all" && r.disposition !== selectedDispo) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !r.contact_name.toLowerCase().includes(s) &&
          !r.agent_name.toLowerCase().includes(s) &&
          !(r.campaign_name || "").toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [recordings, selectedCampaign, selectedAgent, selectedDispo, search]);

  const handlePlay = async (rec: RecordingRow) => {
    if (playingId === rec.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    if (!rec.audio_url) {
      toast({ title: "Recording unavailable", description: "No audio URL for this recording.", variant: "destructive" });
      return;
    }
    audioRef.current?.pause();
    setLoadingAudioId(rec.id);
    setPlayingId(rec.id);
    try {
      const audio = new Audio(rec.audio_url);
      await audio.play();
      audio.onended = () => {
        setPlayingId(null);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPlayingId(null);
        audioRef.current = null;
        toast({ title: "Playback failed", description: "Could not play this recording.", variant: "destructive" });
      };
      audioRef.current = audio;
    } catch (err) {
      setPlayingId(null);
      const message = err instanceof Error ? err.message : "Could not play this recording.";
      toast({ title: "Playback failed", description: message, variant: "destructive" });
    } finally {
      setLoadingAudioId(null);
    }
  };

  const handleDownload = (rec: RecordingRow) => {
    if (!rec.audio_url) {
      toast({ title: "Download unavailable", description: "No audio URL for this recording.", variant: "destructive" });
      return;
    }
    window.open(rec.audio_url, "_blank");
  };

  const handleExport = () => {
    exportToCsv(
      `recordings-${range.from.toISOString().slice(0, 10)}-to-${range.to.toISOString().slice(0, 10)}`,
      filtered.map((r) => ({
        date: format(toESTDate(r.created_at), "yyyy-MM-dd HH:mm"),
        contact: r.contact_name,
        agent: r.agent_name,
        campaign: r.campaign_name || "",
        disposition: r.disposition || "",
        outcome: r.outcome || "",
        duration_seconds: r.duration_seconds || 0,
        has_audio: r.has_audio ? "yes" : "no",
      })),
      [
        { key: "date", label: "Date" },
        { key: "contact", label: "Contact" },
        { key: "agent", label: "Agent" },
        { key: "campaign", label: "Campaign" },
        { key: "disposition", label: "Disposition" },
        { key: "outcome", label: "Outcome" },
        { key: "duration_seconds", label: "Duration (s)" },
        { key: "has_audio", label: "Audio Available" },
      ],
    );
  };

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Recordings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {loading ? "Loading…" : `${filtered.length} of ${recordings.length} recordings in range`}
        </p>
      </div>

      <ReportFilters
        range={range}
        onRangeChange={setRange}
        campaigns={campaigns}
        selectedCampaign={selectedCampaign}
        onCampaignChange={setSelectedCampaign}
        onExport={handleExport}
        exportLabel="Export CSV"
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contact, agent, or campaign"
            className="pl-9 h-9 w-[260px]"
          />
        </div>
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.user_id} value={a.user_id}>
                {a.display_name || a.email?.split("@")[0] || a.user_id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedDispo} onValueChange={setSelectedDispo}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="All dispositions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dispositions</SelectItem>
            {dispositionOptions.map((d) => (
              <SelectItem key={d} value={d}>{d.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {errorMessage && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Disc3}
              title="No recordings match your filters"
              description="Try widening the date range, clearing filters, or making more calls."
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      disabled={!r.has_audio || loadingAudioId === r.id}
                      onClick={() => handlePlay(r)}
                      title={r.has_audio ? "Play recording" : "No audio available"}
                    >
                      {loadingAudioId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : playingId === r.id ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-foreground truncate">{r.contact_name}</p>
                        {!r.has_audio && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {fmtDuration(r.duration_seconds)} • {r.disposition?.replace(/_/g, " ") || r.outcome?.replace(/_/g, " ") || "—"} •
                        {" "}{r.agent_name} • {format(toESTDate(r.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                      {r.campaign_name && (
                        <p className="text-xs text-muted-foreground/70 truncate">{r.campaign_name}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => handleDownload(r)}
                    disabled={!r.has_audio}
                    title={r.has_audio ? "Download" : "No audio available"}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}