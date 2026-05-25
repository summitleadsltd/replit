import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, History, Loader2, Clock, User, FileText, Mic } from "lucide-react";
import { format } from "date-fns";
import { toESTDate } from "@/lib/timezone";

interface Props {
  contactId: string | null;
}

interface AttemptRow {
  id: string;
  created_at: string;
  duration_seconds: number | null;
  disposition: string | null;
  outcome: string | null;
  notes: string | null;
  agent_id: string | null;
  agent_name?: string | null;
  recording_url?: string | null;
  ai_summary?: string | null;
  ai_sentiment?: string | null;
}

const PAGE_SIZE = 10;

function formatDuration(secs: number | null) {
  if (!secs || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CallHistoryPanel({ contactId }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [openSummaries, setOpenSummaries] = useState<Record<string, boolean>>({});
  const requestIdRef = useRef(0);

  const loadRows = useCallback(async (offset: number, append: boolean) => {
    if (!contactId) return;
    const requestId = ++requestIdRef.current;
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const { data: attempts, error } = await supabase
        .from("call_attempts")
        .select("id, created_at, duration_seconds, disposition, outcome, notes, agent_id")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;

      const batch = attempts ?? [];
      setHasMore(batch.length === PAGE_SIZE);

      const attemptIds = batch.map((a) => a.id);
      const agentIds = Array.from(
        new Set(batch.map((a) => a.agent_id).filter(Boolean) as string[])
      );

      const [recRes, sumRes, profRes] = await Promise.all([
        attemptIds.length
          ? supabase
              .from("call_recordings")
              .select("call_attempt_id, recording_url, download_url")
              .in("call_attempt_id", attemptIds)
          : Promise.resolve({ data: [], error: null } as any),
        attemptIds.length
          ? supabase
              .from("ai_summaries")
              .select("call_attempt_id, summary, sentiment")
              .in("call_attempt_id", attemptIds)
          : Promise.resolve({ data: [], error: null } as any),
        agentIds.length
          ? supabase
              .from("profiles")
              .select("user_id, display_name, email")
              .in("user_id", agentIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const recMap = new Map<string, string>();
      for (const r of (recRes.data ?? []) as any[]) {
        const url = r.download_url || r.recording_url;
        if (url && !recMap.has(r.call_attempt_id)) recMap.set(r.call_attempt_id, url);
      }
      const sumMap = new Map<string, { summary: string; sentiment: string | null }>();
      for (const s of (sumRes.data ?? []) as any[]) {
        if (!sumMap.has(s.call_attempt_id))
          sumMap.set(s.call_attempt_id, { summary: s.summary, sentiment: s.sentiment });
      }
      const profMap = new Map<string, string>();
      for (const p of (profRes.data ?? []) as any[]) {
        profMap.set(p.user_id, p.display_name || p.email || "Unknown");
      }

      const merged: AttemptRow[] = batch.map((a) => ({
        ...a,
        agent_name: a.agent_id ? profMap.get(a.agent_id) ?? "Unknown" : "—",
        recording_url: recMap.get(a.id) ?? null,
        ai_summary: sumMap.get(a.id)?.summary ?? null,
        ai_sentiment: sumMap.get(a.id)?.sentiment ?? null,
      }));

      if (requestId !== requestIdRef.current) return; // stale request
      setRows((prev) => (append ? [...prev, ...merged] : merged));
    } catch (e) {
      if (import.meta.env.DEV) console.error("[CallHistoryPanel] load error", e);
      if (requestId !== requestIdRef.current) return; // stale request
      if (!append) setRows([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [contactId]);

  useEffect(() => {
    if (!contactId) { setRows([]); return; }
    loadRows(0, false);
  }, [contactId, loadRows]);

  if (!contactId) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          Call History
          {rows.length > 0 && (
            <Badge variant="secondary" className="text-xs">{rows.length}{hasMore ? "+" : ""}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No previous call attempts
          </p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
            {rows.map((row) => (
              <div
                key={row.id}
                className="border border-border rounded-md p-3 space-y-2 bg-card/50"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {format(toESTDate(row.created_at), "MMM d, yyyy • h:mm a")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">
                      {formatDuration(row.duration_seconds)}
                    </Badge>
                    {(row.disposition || row.outcome) && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {(row.disposition || row.outcome || "").replace(/_/g, " ")}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  Agent: <span className="text-foreground">{row.agent_name}</span>
                </div>

                {row.notes && (
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="text-foreground whitespace-pre-wrap">{row.notes}</span>
                  </div>
                )}

                {row.recording_url && (
                  <div className="flex items-center gap-1.5">
                    <Mic className="w-3 h-3 text-muted-foreground shrink-0" />
                    <audio controls preload="none" className="w-full h-8">
                      <source src={row.recording_url} />
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}

                {row.ai_summary && (
                  <Collapsible
                    open={!!openSummaries[row.id]}
                    onOpenChange={(v) =>
                      setOpenSummaries((s) => ({ ...s, [row.id]: v }))
                    }
                  >
                    <CollapsibleTrigger className="w-full flex items-center justify-between text-xs text-primary hover:underline">
                      <span>AI Summary</span>
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${openSummaries[row.id] ? "rotate-180" : ""}`}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-2">
                      {row.ai_sentiment && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {row.ai_sentiment}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {row.ai_summary}
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            ))}

            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => loadRows(rows.length, true)}
                disabled={loadingMore}
              >
                {loadingMore ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Load More
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}