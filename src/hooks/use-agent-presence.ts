import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AgentPresence {
  user_id: string;
  display_name: string | null;
  email: string | null;
  status: "available" | "on_call" | "away" | "offline";
  last_heartbeat_at: string;
  current_call_attempt_id: string | null;
  current_room_name: string | null;
}

const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
const OFFLINE_THRESHOLD_MS = 30000; // 30 seconds

export function useAgentPresence() {
  const [presence, setPresence] = useState<AgentPresence[]>([]);
  const [myPresence, setMyPresence] = useState<Partial<AgentPresence>>({ status: "offline" });
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Send heartbeat
  const sendHeartbeat = useCallback(async (status: AgentPresence["status"], currentCallId?: string | null, roomName?: string | null) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      await supabase
        .from("agent_presence")
        .upsert({
          user_id: session.session.user.id,
          status,
          last_heartbeat_at: new Date().toISOString(),
          current_call_attempt_id: currentCallId || null,
          current_room_name: roomName || null,
        }, { onConflict: "user_id" });
    } catch (err) {
      if (import.meta.env.DEV) console.error("[AgentPresence] Heartbeat failed:", err);
    }
  }, []);

  // Set agent status
  const setStatus = useCallback(async (status: AgentPresence["status"]) => {
    await sendHeartbeat(status);
    setMyPresence((prev) => ({ ...prev, status }));
  }, [sendHeartbeat]);

  // Set current call
  const setCurrentCall = useCallback(async (callAttemptId: string | null, roomName: string | null) => {
    const status = callAttemptId ? "on_call" : "available";
    await sendHeartbeat(status, callAttemptId, roomName);
    setMyPresence((prev) => ({ ...prev, status, current_call_attempt_id: callAttemptId, current_room_name: roomName }));
  }, [sendHeartbeat]);

  // Start heartbeat when dialer is active
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) return;
    
    // Immediate first heartbeat
    sendHeartbeat("available");
    
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat(myPresence.status || "available", myPresence.current_call_attempt_id, myPresence.current_room_name);
    }, HEARTBEAT_INTERVAL_MS);
  }, [sendHeartbeat, myPresence]);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    // Mark offline on stop
    sendHeartbeat("offline");
  }, [sendHeartbeat]);

  // Subscribe to presence updates
  useEffect(() => {
    const channel = supabase
      .channel("agent_presence_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_presence" },
        async () => {
          // Refetch all presence data
          const { data } = await supabase
            .from("agent_presence")
            .select("user_id, status, last_heartbeat_at, current_call_attempt_id, current_room_name, profiles:user_id(display_name, email)")
            .gt("last_heartbeat_at", new Date(Date.now() - OFFLINE_THRESHOLD_MS).toISOString());
          
          if (data) {
            const mapped: AgentPresence[] = data.map((p: any) => ({
              user_id: p.user_id,
              display_name: p.profiles?.display_name || null,
              email: p.profiles?.email || null,
              status: p.status,
              last_heartbeat_at: p.last_heartbeat_at,
              current_call_attempt_id: p.current_call_attempt_id,
              current_room_name: p.current_room_name,
            }));
            setPresence(mapped);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Initial fetch
    const fetchPresence = async () => {
      const { data } = await supabase
        .from("agent_presence")
        .select("user_id, status, last_heartbeat_at, current_call_attempt_id, current_room_name, profiles:user_id(display_name, email)")
        .gt("last_heartbeat_at", new Date(Date.now() - OFFLINE_THRESHOLD_MS).toISOString());
      
      if (data) {
        const mapped: AgentPresence[] = data.map((p: any) => ({
          user_id: p.user_id,
          display_name: p.profiles?.display_name || null,
          email: p.profiles?.email || null,
          status: p.status,
          last_heartbeat_at: p.last_heartbeat_at,
          current_call_attempt_id: p.current_call_attempt_id,
          current_room_name: p.current_room_name,
        }));
        setPresence(mapped);
      }
    };
    fetchPresence();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  return {
    presence,
    myPresence,
    setStatus,
    setCurrentCall,
    startHeartbeat,
    stopHeartbeat,
  };
}
