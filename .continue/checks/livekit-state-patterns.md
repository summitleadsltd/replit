---
name: LiveKit State Patterns
description: Validates LiveKit telephony code follows established patterns for async state, cleanup, and error handling.
---

# LiveKit State Patterns

## Context

The Summit CRM's dialer uses LiveKit WebRTC for browser-based calling. The `use-livekit-client.ts` hook manages complex async state including:
- Room connections
- Participant tracking (SIP participants = leads)
- Call state machines (idle → connecting → ringing → active → ending)
- Timer management for call duration

Race conditions and state mismatches cause:
- Ghost calls (UI shows active but no audio)
- Stuck connecting state
- Memory leaks from uncleared timers
- Duplicate dial attempts

## What to Check

### 1. Refs for Async State

**REQUIRED:** Use refs for state accessed in async callbacks and event handlers.

**PATTERN from `use-livekit-client.ts`:**
```typescript
// GOOD: Refs for async access
const dialingRef = useRef(false);
const currentRoomName = useRef<string | null>(null);
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

**FAIL** if state variables are read in async callbacks without refs:
```typescript
// BAD: May have stale closure
const dial = useCallback(async () => {
  if (isDialing) return; // State variable — may be stale!
  setIsDialing(true);
}, [isDialing]);
```

### 2. Cleanup on Unmount

**REQUIRED:** Disconnect room and clear timers in cleanup effect.

**GOOD pattern:**
```typescript
useEffect(() => {
  return () => {
    stopTimer();
    roomRef.current?.disconnect();
    roomRef.current = null;
  };
}, [stopTimer]);
```

**FAIL** if:
- Room disconnect missing from cleanup
- Timers not cleared (will leak)
- Event listeners not removed

### 3. Dial Guard

**REQUIRED:** Prevent simultaneous dial attempts.

**GOOD pattern:**
```typescript
const dial = useCallback(async () => {
  if (dialingRef.current) {
    console.warn("[LiveKit] Dial ignored — already dialing");
    return;
  }
  dialingRef.current = true;
  // ... dial logic
}, []);
```

**FAIL** if:
- No guard against concurrent dials
- Uses state variable instead of ref for guard

### 4. Error State Reset

**REQUIRED:** Clear error messages on new operations.

**GOOD pattern:**
```typescript
const dial = useCallback(async () => {
  setErrorMessage(null); // Clear previous errors
  setCallState("connecting");
  // ...
}, []);
```

**FAIL** if:
- Errors persist across operations
- No error clearing at operation start
- Errors not surfaced to UI

### 5. Room Lifecycle

**REQUIRED:** Disconnect previous room before connecting new one.

**GOOD pattern:**
```typescript
if (roomRef.current) {
  await roomRef.current.disconnect();
  roomRef.current = null;
}
const room = await connectToRoom(wsUrl, token);
roomRef.current = room;
```

**FAIL** if:
- Multiple simultaneous room connections
- Room switch without cleanup

### 6. Event Handler Wiring

**REQUIRED:** Wire event handlers BEFORE connecting.

**GOOD pattern:**
```typescript
room.on(RoomEvent.ConnectionStateChanged, handler);
room.on(RoomEvent.ParticipantConnected, handler);
room.on(RoomEvent.ParticipantDisconnected, handler);
await room.connect(wsUrl, token);
```

**FAIL** if:
- Connect called before handlers attached
- Event handlers attached after potential race window

### 7. Timer Management

**REQUIRED:** Centralized timer start/stop with ref cleanup.

**GOOD pattern:**
```typescript
const stopTimer = useCallback(() => {
  if (!timerRef.current) return;
  clearInterval(timerRef.current);
  timerRef.current = null;
}, []);

// Start timer
stopTimer();
timerRef.current = setInterval(() => {
  setCallDuration(s => s + 1);
}, 1000);
```

**FAIL** if:
- Multiple timers running (duration jumps)
- Timer not cleared on hangup
- Timer not cleared on unmount

## Red Flags (FAIL)

1. **Missing ref guards:**
```typescript
const [isDialing, setIsDialing] = useState(false);
const dial = async () => {
  if (isDialing) return; // FAIL: State variable, not ref
  setIsDialing(true);
};
```

2. **No cleanup effect:**
```typescript
// FAIL: No disconnect on unmount
useEffect(() => {
  init();
}, []); // Missing cleanup
```

3. **Timer leak:**
```typescript
// FAIL: Timer not cleared
setInterval(() => setDuration(d => d + 1), 1000);
```

4. **Double room connection:**
```typescript
// FAIL: May create orphan room
if (room) await room.connect(); // Reusing old room
// vs
createRoom(); connect(); // New room without disconnecting old
```

## Key Files to Review

- `src/hooks/use-livekit-client.ts` — primary LiveKit integration
- `src/hooks/use-dialer-queue.ts` — queue state coordination
- `src/pages/Dialer.tsx` — dialer UI state
- `src/components/dialer/CallTimeline.tsx` — call state display

## Exclusions

These patterns are NOT LiveKit-specific and not checked:
- General React state management (useState, useReducer)
- Non-telephony async operations
- Form handling
- Data fetching patterns (React Query handles this)

## Fix Guidance

When fixing race conditions:

```typescript
// Use ref for guard
const dialingRef = useRef(false);

const dial = useCallback(async () => {
  if (dialingRef.current) return;
  dialingRef.current = true;
  
  try {
    // ... dial logic
  } finally {
    dialingRef.current = false;
  }
}, []);
```

Always pair `setInterval` with cleanup:
```typescript
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, []);
```
