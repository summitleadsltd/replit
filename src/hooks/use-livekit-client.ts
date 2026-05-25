// src/hooks/use-livekit-client.ts
// ─────────────────────────────────────────────────────────────
// Connects the browser to a LiveKit
// room via WebRTC. PSTN calls are handled server-side via SIP.
// When the agent dials, the edge function creates the room +
// SIP participant; the browser joins the same room to hear audio.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room,
  RoomEvent,
  ConnectionState,
  RemoteParticipant,
  RemoteAudioTrack,
  Track,
} from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from '@capacitor/core';

// Request microphone permission on mobile before LiveKit connection
async function requestMicrophonePermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true; // Browser handles its own

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop()); // Release immediately
    return true;
  } catch (err) {
    if (import.meta.env.DEV) console.error('[MobileAuth] Microphone permission denied:', err);
    return false;
  }
}

export type LiveKitConnectionState =
  | "not_configured"
  | "connecting"
  | "ready"
  | "error";
export type LiveKitCallState =
  | "idle"
  | "connecting"
  | "ringing"
  | "active"
  | "ending";
export type CallTimelineStage =
  | "initiated"
  | "ringing"
  | "active"
  | "hangup"
  | "disposition";
export type CallTimelineEntry = {
  stage: CallTimelineStage;
  at: string;
  detail?: string;
};

export function useLiveKitClient() {
  const roomRef = useRef<Room | null>(null);
  const dialingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRoomName = useRef<string | null>(null);
  const currentCallControlId = useRef<string | null>(null);
  const callStartedAtRef = useRef<string | null>(null);

  const [diagLog, setDiagLog] = useState<string[]>([]);
  const diag = (msg: string) => {
    const line = `${new Date().toISOString().slice(11,23)} ${msg}`;
    console.log("[LiveKit:diag]", line);
    setDiagLog(prev => [...prev.slice(-29), line]);
  };

  const [isRegistered, setIsRegistered] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<LiveKitConnectionState>("not_configured");
  const [callState, setCallState] = useState<LiveKitCallState>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [awaitingDisposition, setAwaitingDisposition] = useState(false);
  const [callTimeline, setCallTimeline] = useState<CallTimelineEntry[]>([]);
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [lastCallDuration, setLastCallDuration] = useState(0);
  const [lastCallStartedAt, setLastCallStartedAt] = useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<string | null>(null);

  const stopTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const resetCall = useCallback((showDisposition = false) => {
    stopTimer();
    // Snapshot timing before clearing
    setLastCallStartedAt(callStartedAtRef.current);
    setCallDuration((prev) => { setLastCallDuration(prev); return 0; });
    dialingRef.current = false;
    currentRoomName.current = null;
    currentCallControlId.current = null;
    callStartedAtRef.current = null;
    setIsCallActive(false);
    setCallState("idle");
    if (showDisposition) setAwaitingDisposition(true);
    setMuted(false);
    setHeld(false);
  }, [stopTimer]);

  // Verify LiveKit credentials on mount (don't connect — no persistent room needed).
  // Rooms are created per-call by the edge function; the browser joins only when dialing.
  const init = useCallback(async () => {
    try {
      setConnectionStatus("connecting");
      setErrorMessage(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setConnectionStatus("not_configured");
        return;
      }

      // Mark ready immediately for authenticated users — LiveKit credentials
      // are verified server-side on each dial. Don't block the UI on a probe call.
      setIsRegistered(true);
      setConnectionStatus("ready");
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "LiveKit init failed"
      );
      setConnectionStatus("error");
      setIsRegistered(false);
    }
  }, []);

  useEffect(() => {
    init();
    return () => {
      stopTimer();
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [init, stopTimer]);

  // Attach remote audio track to a real <audio> element.
  // Required even in LiveKit v2 when adaptiveStream=false — without an attached
  // element the Web Audio sink has no output destination and you hear silence.
  const attachAudioTrack = useCallback((track: Track) => {
    if (track.kind !== Track.Kind.Audio) return;
    const audioTrack = track as RemoteAudioTrack;
    diag(`attachAudioTrack sid=${audioTrack.sid} muted=${audioTrack.isMuted}`);
    // Use a dedicated persistent element — reuse if already exists
    let el = document.getElementById("livekit-remote-audio") as HTMLAudioElement | null;
    if (!el) {
      el = document.createElement("audio");
      el.id = "livekit-remote-audio";
      el.autoplay = true;
      el.setAttribute("playsinline", "");
      document.body.appendChild(el);
      diag("created livekit-remote-audio element");
    }
    audioTrack.attach(el);
    el.muted = false;
    el.volume = 1.0;
    el.play().catch((e) => diag(`play() blocked: ${e.message}`));
    diag(`attached to #livekit-remote-audio muted=${el.muted} vol=${el.volume} paused=${el.paused}`);
  }, []);

  // Helper: create a Room, wire up ALL event listeners, then connect
  const connectToRoom = useCallback(
    async (wsUrl: string, token: string): Promise<Room> => {
      const room = new Room({
        // adaptiveStream must be FALSE for SIP audio calls — when true, LiveKit
        // throttles/mutes tracks not attached to a visible DOM element, causing
        // silence even though RTP is flowing at the server level.
        adaptiveStream: false,
        dynacast: false,
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Disconnected) {
          setIsCallActive(false);
        }
      });

      room.on(RoomEvent.Disconnected, (reason) => {
        diag(`room disconnected reason=${reason ?? "unknown"}`);
      });

      // ── Audio: attach any remote audio track as soon as it arrives ──
      // Must be registered BEFORE connect() so no tracks are missed
      room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        diag(`TrackSubscribed kind=${track.kind} sid=${track.sid} from=${participant.identity}`);
        if (track.kind === Track.Kind.Audio) {
          attachAudioTrack(track);
        }
      });

      // When SIP participant joins (lead answers / ringing starts), activate call
      const activateCall = () => {
        setIsCallActive(true);
        setCallState("active");
        callStartedAtRef.current = new Date().toISOString();
        setCallStartedAt(new Date().toISOString());
        setCallTimeline((prev) => [
          ...prev,
          { stage: "active", at: new Date().toISOString() },
        ]);
        stopTimer();
        timerRef.current = setInterval(() => {
          setCallDuration((s) => s + 1);
        }, 1000);
      };

      room.on(
        RoomEvent.ParticipantConnected,
        (participant: RemoteParticipant) => {
          diag(`ParticipantConnected identity=${participant.identity}`);
          if (participant.identity.startsWith("sip_")) {
            activateCall();
          }
        }
      );

      // When the SIP participant leaves (lead hangs up), end the call
      room.on(
        RoomEvent.ParticipantDisconnected,
        (participant: RemoteParticipant) => {
          if (participant.identity.startsWith("sip_") && roomRef.current) {
            if (import.meta.env.DEV) console.log("[LiveKit] SIP participant disconnected (lead hung up)");
            setCallTimeline((prev) => [
              ...prev,
              { stage: "hangup", at: new Date().toISOString() },
            ]);
            resetCall(true);
          }
        }
      );

      diag(`connecting to room wsUrl=${wsUrl.slice(0,30)}...`);
      await room.connect(wsUrl, token);
      roomRef.current = room;
      diag(`room connected participants=${room.remoteParticipants.size}`);

      // Unlock AudioContext AFTER connect (room must be connected first in LiveKit v2).
      // startAudio() is safe here because we're still within the async chain
      // started by the user's dial button click gesture.
      diag("calling startAudio() after connect...");
      await room.startAudio().catch((e) => diag(`startAudio err: ${e}`));
      diag(`startAudio done canPlayback=${room.canPlaybackAudio}`);

      // Re-unlock if browser re-suspends AudioContext (e.g. tab focus changes)
      room.on(RoomEvent.AudioPlaybackStatusChanged, async () => {
        diag(`AudioPlaybackStatusChanged canPlayback=${room.canPlaybackAudio}`);
        if (!room.canPlaybackAudio) {
          await room.startAudio().catch(() => {});
        }
      });

      // Attach any tracks already present after connect
      for (const [, participant] of room.remoteParticipants) {
        for (const publication of participant.trackPublications.values()) {
          if (publication.isSubscribed && publication.track?.kind === Track.Kind.Audio) {
            attachAudioTrack(publication.track);
          }
        }
        if (participant.identity.startsWith("sip_")) {
          diag(`SIP participant already present: ${participant.identity}`);
          activateCall();
        }
      }

      return room;
    },
    [resetCall, stopTimer, attachAudioTrack]
  );

  const dial = useCallback(
    async (destinationNumber: string, callerNumber: string) => {
      // Prevent multiple simultaneous dials
      if (dialingRef.current) {
        if (import.meta.env.DEV) console.warn("[LiveKit] Dial ignored — already dialing");
        return;
      }
      dialingRef.current = true;
      setErrorMessage(null);
      setCallDuration(0);
      setAwaitingDisposition(false);
      setCallState("connecting");
      setCallTimeline([{ stage: "initiated", at: new Date().toISOString() }]);
      setDiagLog([]);
      diag(`dial() called to=${destinationNumber} from=${callerNumber}`);

      try {
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        diag(`calling livekit-call-control edge fn...`);
        const res = await fetch(`${supabaseUrl}/functions/v1/livekit-call-control`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "apikey": anonKey,
          },
          body: JSON.stringify({
            action: "dial",
            to: destinationNumber,
            from: callerNumber || undefined,
          }),
        });

        const data = await res.json().catch(() => null);
        diag(`edge fn response: status=${res.status} success=${data?.success} room=${data?.call?.room_name} callerId=${data?.selectedCallerId||"NONE"} reason=${data?.selectionReason||"?"} err=${data?.error||"none"}`);
        
        if (!res.ok || !data?.success) {
          const msg = data?.error || data?.message || `Dial failed (${res.status})`;
          setErrorMessage(msg);
          setCallState("idle");
          dialingRef.current = false;
          return;
        }

        currentRoomName.current = data.call?.room_name || null;
        currentCallControlId.current = data.call?.call_control_id || null;

        // Connect the agent's browser to the call room
        if (data.call?.room_name) {
          // Request microphone permission on mobile before connecting
          const micPermission = await requestMicrophonePermission();
          if (!micPermission) {
            setErrorMessage("Microphone permission required for calls");
            setCallState("idle");
            dialingRef.current = false;
            return;
          }

          // Disconnect any previous room
          if (roomRef.current) {
            await roomRef.current.disconnect();
            roomRef.current = null;
          }

          // Get a token scoped to the call room
          const { data: tokenData, error: tokenErr } =
            await supabase.functions.invoke("livekit-token", {
              body: { roomName: data.call.room_name },
            });
          diag(`token fetch: err=${tokenErr?.message||"none"} hasToken=${!!tokenData?.token} wsUrl=${tokenData?.wsUrl?.slice(0,30)||"none"}`);
          if (tokenErr || !tokenData?.token) {
            setErrorMessage("Failed to get call room token");
            setCallState("idle");
            dialingRef.current = false;
            return;
          }

          const room = await connectToRoom(tokenData.wsUrl, tokenData.token);
          diag(`connectToRoom done. Mic enabling...`);

          // Chrome sometimes re-suspends AudioContext even after startAudio().
          // Register a one-shot click/keydown handler to force-resume it.
          const unlockAudio = () => {
            if (!room.canPlaybackAudio) {
              room.startAudio().catch(() => {});
              diag("AudioContext re-unlocked via user gesture");
            }
          };
          document.addEventListener("click", unlockAudio, { once: true });
          document.addEventListener("keydown", unlockAudio, { once: true });

          // Enable microphone for the agent (non-blocking — mic errors shouldn't stop the call)
          room.localParticipant.setMicrophoneEnabled(true).catch((micErr) => {
            if (import.meta.env.DEV) console.warn("[LiveKit] Mic enable failed (non-fatal):", micErr);
          });
        }

        setCallState("ringing");
        setCallTimeline((prev) => [
          ...prev,
          { stage: "ringing", at: new Date().toISOString() },
        ]);
        // dialingRef stays true while call is active; reset happens in resetCall/hangUp
      } catch (err) {
        if (import.meta.env.DEV) console.error("[LiveKit] Dial error:", err);
        setErrorMessage(
          err instanceof Error ? err.message : "Dial failed"
        );
        setCallState("idle");
        dialingRef.current = false;
      }
    },
    [connectToRoom]
  );

  const hangUp = useCallback(async () => {
    try {
      if (currentRoomName.current || currentCallControlId.current) {
        await supabase.functions.invoke("livekit-call-control", {
          body: {
            action: "hangup",
            callControlId: currentCallControlId.current,
            roomName: currentRoomName.current,
          },
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error("[LiveKit] Hangup failed:", error);
    }

    // Add hangup to timeline before disconnecting
    setCallTimeline((prev) => [
      ...prev,
      { stage: "hangup", at: new Date().toISOString() },
    ]);

    // Disconnect from call room and clean up audio element
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    const audioEl = document.getElementById("livekit-remote-audio");
    if (audioEl) audioEl.remove();

    // Snapshot call timing before reset so disposition can use accurate data
    stopTimer();
    setLastCallStartedAt(callStartedAtRef.current);
    setCallDuration((prev) => { setLastCallDuration(prev); return 0; });

    // Clear refs and reset state
    dialingRef.current = false;
    currentRoomName.current = null;
    currentCallControlId.current = null;
    callStartedAtRef.current = null;
    setIsCallActive(false);
    setCallState("idle");
    setMuted(false);
    setHeld(false);
    setAwaitingDisposition(true);
  }, [stopTimer]);

  const toggleMute = useCallback(async () => {
    if (!roomRef.current) return;
    try {
      const newMuted = !muted;
      await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted);
      setMuted(newMuted);
    } catch (error) {
      if (import.meta.env.DEV) console.error("[LiveKit] Mute toggle failed:", error);
      setErrorMessage("Could not update microphone mute state.");
    }
  }, [muted]);

  const toggleHold = useCallback(async () => {
    // Hold: mute local audio + optionally mute remote audio
    // Full hold with music would require a server-side participant
    if (!roomRef.current) return;
    const newHeld = !held;
    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(!newHeld);
      setHeld(newHeld);
      setMuted(newHeld);
    } catch (error) {
      if (import.meta.env.DEV) console.error("[LiveKit] Hold toggle failed:", error);
    }
  }, [held]);

  const sendDTMF = useCallback(async (digit: string) => {
    if (!roomRef.current || !currentCallControlId.current) return;
    try {
      // Send DTMF via LiveKit SIP data channel
      // LiveKit supports sending DTMF to SIP participants via the publishData method
      const encoder = new TextEncoder();
      const dtmfPayload = JSON.stringify({
        type: "dtmf",
        digit,
        participant: currentCallControlId.current,
      });
      await roomRef.current.localParticipant.publishData(
        encoder.encode(dtmfPayload),
        { reliable: true }
      );
    } catch (error) {
      if (import.meta.env.DEV) console.error("[LiveKit] DTMF failed:", error);
      setErrorMessage("Could not send DTMF tone.");
    }
  }, []);

  const submitDisposition = useCallback((dispositionCode: string) => {
    setCallTimeline((prev) => [
      ...prev,
      {
        stage: "disposition",
        at: new Date().toISOString(),
        detail: dispositionCode,
      },
    ]);
    setAwaitingDisposition(false);
  }, []);

  // Expose current room name for transfer functionality
  const roomName = currentRoomName.current;
  const callControlId = currentCallControlId.current;

  return {
    isRegistered,
    isCallActive,
    connectionStatus,
    callState,
    callDuration,
    errorMessage,
    awaitingDisposition,
    callTimeline,
    callStartedAt,
    lastCallDuration,
    lastCallStartedAt,
    muted,
    held,
    dial,
    hangUp,
    toggleMute,
    toggleHold,
    sendDTMF,
    submitDisposition,
    diagLog,
    roomName,
    callControlId,
  };
}
