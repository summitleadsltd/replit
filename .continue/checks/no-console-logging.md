---
name: No Console Logging
description: Flags console.log/warn/error/debug in production UI code while allowing in edge functions and tests.
---

# No Console Logging

## Context

The Summit CRM has 61+ console statements scattered across 21 files. While useful during development, console logging in production:

- Leaks internal state to users
- Creates noise in Sentry/error tracking
- Violates clean code hygiene

Per the project README: "audit failures should be silent for users" — the same principle applies to all logging.

## What to Check

### 1. UI Code (src/pages, src/components, src/hooks)

**FAIL** if `console.log`, `console.warn`, `console.error`, or `console.debug` appear in:

- React components
- Custom hooks
- Page containers

**GOOD examples from codebase (compliant):**

```typescript
// src/lib/audit.ts - silently swallows errors (correct)
if (error) {
  console.warn("[audit] log_audit_event failed:", error.message);
  return null;
}
```

→ This is OK because it's in a utility lib with categorized prefix.

**BAD examples from codebase (flag it):**

```typescript
// src/hooks/use-dialer-queue.ts
console.log("[useDialerQueue] Auto-assigning to:", assigneeId);

// src/hooks/use-livekit-client.ts
console.log("[LiveKit] dial response:", res.status, data);

// src/pages/Dialer.tsx
console.log("[Dialer] Campaign changed, resetting queue");
```

### 2. Edge Functions (supabase/functions)

**PASS** — Console logging is allowed and expected here for server-side debugging. Do not flag.

### 3. Test Files (src/test, *.test.ts,*.spec.ts)

**PASS** — Console logging in tests is acceptable for debugging test failures.

### 4. Utility Libs with Prefixed Logging (src/lib)

**WARNING** — Prefixed console output (e.g., `[audit]`, `[LiveKit]`) is borderline. Accept only if:

- The prefix is module-specific
- The log is in an error/failure path
- The log aids debugging production issues

## Key Files

These files commonly have console statements that should be reviewed:

- `src/hooks/use-dialer-queue.ts`
- `src/hooks/use-livekit-client.ts`
- `src/hooks/use-mobile-auth.ts`
- `src/pages/Dialer.tsx`
- `src/pages/ConfirmerQueue.tsx`

## Exclusions

This check does NOT apply to:

- `supabase/functions/*` — edge functions need debug logging
- `src/test/*` — test files
- `*.test.ts`, `*.spec.ts` — test files anywhere
- `vite.config.ts`, `playwright.config.ts` — config files
- Build scripts and tooling configs

## Fix Guidance

Replace console statements with:

1. **Production error tracking** — Use error reporting service if available
2. **Silent failures** — Remove logs that "just work" in production
3. **Debug flags** — Wrap in `if (import.meta.env.DEV)` for development-only logging

Example fix:

```typescript
// Before:
console.log("[Dialer] Campaign changed, resetting queue");

// After (development only):
if (import.meta.env.DEV) {
  console.log("[Dialer] Campaign changed, resetting queue");
}
```
