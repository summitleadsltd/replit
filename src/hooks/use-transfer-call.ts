import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AgentPresence } from "./use-agent-presence";

export type TransferType = "warm" | "cold";

export interface TransferState {
  isTransferring: boolean;
  transferStage: "idle" | "dialing_agent" | "consulting" | "completing" | "completed" | "failed";
  targetAgent: AgentPresence | null;
  error: string | null;
  transferTimeout: ReturnType<typeof setTimeout> | null;
}

const TRANSFER_TIMEOUT_MS = 20000; // 20 seconds

export function useTransferCall(
  roomName: string | null,
  callControlId: string | null,
  currentLeadId: string | null,
  onTransferComplete?: () => void,
  onTransferFailed?: () => void
) {
  const [state, setState] = useState<TransferState>({
    isTransferring: false,
    transferStage: "idle",
    targetAgent: null,
    error: null,
    transferTimeout: null,
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTransferTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetTransfer = useCallback(() => {
    clearTransferTimeout();
    setState({
      isTransferring: false,
      transferStage: "idle",
      targetAgent: null,
      error: null,
      transferTimeout: null,
    });
  }, [clearTransferTimeout]);

  // Initiate warm transfer
  const initiateWarmTransfer = useCallback(async (
    targetAgent: AgentPresence,
    context: string,
    callAttemptId: string
  ) => {
    if (!roomName || !callControlId) {
      setState((s) => ({ ...s, error: "No active call to transfer" }));
      return false;
    }

    setState({
      isTransferring: true,
      transferStage: "dialing_agent",
      targetAgent,
      error: null,
      transferTimeout: null,
    });

    try {
      // Get target agent's direct dial number or use a conference bridge
      // For now, we use the existing transfer mechanism
      const { error: transferErr } = await supabase.functions.invoke("livekit-call-control", {
        body: {
          action: "transfer",
          roomName,
          callControlId,
          transferTo: "warm_hold", // Special identifier for warm transfer
          targetAgentId: targetAgent.user_id,
          context,
          warmTransfer: true,
        },
      });

      if (transferErr) throw transferErr;

      // Set timeout for agent answer
      timeoutRef.current = setTimeout(() => {
        setState((s) => ({
          ...s,
          transferStage: "failed",
          error: "Spanish agent did not answer within 20 seconds",
          isTransferring: false,
        }));
        onTransferFailed?.();
      }, TRANSFER_TIMEOUT_MS);

      // Update call_attempts with transfer info
      await supabase
        .from("call_attempts")
        .update({
          transferred_to_agent_id: targetAgent.user_id,
          transfer_type: "warm",
        })
        .eq("id", callAttemptId);

      setState((s) => ({ ...s, transferStage: "consulting" }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transfer failed";
      setState((s) => ({ ...s, error: msg, transferStage: "failed", isTransferring: false }));
      onTransferFailed?.();
      return false;
    }
  }, [roomName, callControlId, onTransferFailed]);

  // Complete warm transfer (after context exchange)
  const completeWarmTransfer = useCallback(async (callAttemptId: string, fromAgentId: string) => {
    if (!roomName || !callControlId) return false;

    setState((s) => ({ ...s, transferStage: "completing" }));
    clearTransferTimeout();

    try {
      // Remove original agent from room
      await supabase.functions.invoke("livekit-call-control", {
        body: {
          action: "remove_participant",
          roomName,
          identity: `agent_${fromAgentId}`,
        },
      });

      // Update call record
      await supabase
        .from("call_attempts")
        .update({
          transferred_from_agent_id: fromAgentId,
          transferred_at: new Date().toISOString(),
        })
        .eq("id", callAttemptId);

      // Update lead assignment
      if (currentLeadId && state.targetAgent) {
        await supabase
          .from("contacts")
          .update({ locked_to_agent_id: state.targetAgent.user_id })
          .eq("id", currentLeadId);
      }

      setState((s) => ({ ...s, transferStage: "completed", isTransferring: false }));
      onTransferComplete?.();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to complete transfer";
      setState((s) => ({ ...s, error: msg, transferStage: "failed", isTransferring: false }));
      return false;
    }
  }, [roomName, callControlId, currentLeadId, state.targetAgent, clearTransferTimeout, onTransferComplete]);

  // Cold transfer (immediate handoff)
  const initiateColdTransfer = useCallback(async (
    targetAgent: AgentPresence,
    callAttemptId: string,
    fromAgentId: string
  ) => {
    if (!roomName || !callControlId) {
      setState((s) => ({ ...s, error: "No active call to transfer" }));
      return false;
    }

    setState({
      isTransferring: true,
      transferStage: "completing",
      targetAgent,
      error: null,
      transferTimeout: null,
    });

    try {
      // Use standard transfer - replaces caller with Spanish agent
      const { error: transferErr } = await supabase.functions.invoke("livekit-call-control", {
        body: {
          action: "transfer",
          roomName,
          callControlId,
          transferTo: "cold_handoff",
          targetAgentId: targetAgent.user_id,
          warmTransfer: false,
        },
      });

      if (transferErr) throw transferErr;

      // Update call record
      await supabase
        .from("call_attempts")
        .update({
          transferred_from_agent_id: fromAgentId,
          transferred_to_agent_id: targetAgent.user_id,
          transferred_at: new Date().toISOString(),
          transfer_type: "cold",
        })
        .eq("id", callAttemptId);

      // Update lead assignment
      if (currentLeadId) {
        await supabase
          .from("contacts")
          .update({ locked_to_agent_id: targetAgent.user_id })
          .eq("id", currentLeadId);
      }

      setState((s) => ({ ...s, transferStage: "completed", isTransferring: false }));
      onTransferComplete?.();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transfer failed";
      setState((s) => ({ ...s, error: msg, transferStage: "failed", isTransferring: false }));
      onTransferFailed?.();
      return false;
    }
  }, [roomName, callControlId, currentLeadId, onTransferComplete, onTransferFailed]);

  // Flag lead for Spanish callback (no agents available)
  const flagForSpanishCallback = useCallback(async (contactId: string) => {
    const { error } = await supabase
      .from("contacts")
      .update({
        language: "es",
        callback_disposition: "callback_spanish",
      })
      .eq("id", contactId);

    if (error) {
      if (import.meta.env.DEV) console.error("[useTransferCall] Failed to flag lead:", error);
      return false;
    }
    return true;
  }, []);

  return {
    ...state,
    initiateWarmTransfer,
    completeWarmTransfer,
    initiateColdTransfer,
    flagForSpanishCallback,
    resetTransfer,
    clearTransferTimeout,
  };
}
