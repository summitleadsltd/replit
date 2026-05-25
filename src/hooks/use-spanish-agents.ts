import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAgentPresence, type AgentPresence } from "./use-agent-presence";

export interface SpanishAgent extends AgentPresence {
  language_skills: string[];
}

export function useSpanishAgents() {
  const { presence: allPresence } = useAgentPresence();
  const [spanishAgents, setSpanishAgents] = useState<SpanishAgent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSpanishAgents = useCallback(async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        setSpanishAgents([]);
        return;
      }

      // Get current user's company
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", session.session.user.id)
        .single();

      // Use the database function for efficient querying
      const { data, error } = await supabase.rpc("get_available_spanish_agents", {
        p_company_id: profile?.company_id || null,
      });

      if (error) {
        if (import.meta.env.DEV) console.error("[useSpanishAgents] RPC failed:", error.message);
        // Fallback: filter from presence
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, email, language_skills")
          .contains("language_skills", ["es"])
          .eq("is_active", true);

        const filtered = allPresence.filter((p) => 
          profiles?.some((prof: any) => prof.user_id === p.user_id && p.status === "available")
        );

        setSpanishAgents(filtered.map((p) => ({
          ...p,
          language_skills: profiles?.find((prof: any) => prof.user_id === p.user_id)?.language_skills || ["en"],
        })));
        return;
      }

      const mapped: SpanishAgent[] = (data || []).map((row: any) => ({
        user_id: row.user_id,
        display_name: row.display_name,
        email: row.email,
        status: row.status,
        last_heartbeat_at: row.last_heartbeat_at,
        current_call_attempt_id: row.current_call_attempt_id,
        current_room_name: null,
        language_skills: ["es"], // From the function, we know they're Spanish agents
      }));

      setSpanishAgents(mapped);
    } finally {
      setLoading(false);
    }
  }, [allPresence]);

  // Refetch when presence changes (fetchSpanishAgents identity updates when allPresence changes)
  useEffect(() => {
    fetchSpanishAgents();
  }, [fetchSpanishAgents]);

  const availableAgents = spanishAgents.filter((a) => a.status === "available" && !a.current_call_attempt_id);
  const busyAgents = spanishAgents.filter((a) => a.status === "on_call" || a.current_call_attempt_id);

  return {
    agents: spanishAgents,
    availableAgents,
    busyAgents,
    hasAvailableAgents: availableAgents.length > 0,
    loading,
    refresh: fetchSpanishAgents,
  };
}
