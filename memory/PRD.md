# Summit Leads CRM — PRD & Engineering Notes

## Original Problem Statement
"Review, repair and re-code Summit Voice CRM" — concretely:
- Recordings page doesn't load
- No pagination across the app
- Appointments not showing in technician calendar
- Training Hub not working at all
- No contact history in dialer page
- No daily assigned leads showing in dialer
- Dialer repeats previously contacted leads instead of new ones
- CSV exports don't work
- Whole system must operate in Eastern Time end-to-end

## Stack (existing)
- Frontend: Vite + React 18 + TypeScript + Tailwind + shadcn-ui + react-query
- Backend: Supabase (Auth, Postgres + RLS, 100 SQL migrations, 15 Deno edge functions)
- Telephony: LiveKit (WebRTC) + Telnyx (SIP trunk bridge)
- AI: OpenRouter / api-free-llm (legacy) → OpenAI direct (new)
- Mobile: Capacitor (Android) + separate Expo React Native technician app (not touched in this session)

## Live Environment
- Frontend served on this pod (Vite dev server, port 3000 via supervisor)
- Connected to user's Supabase project: `wggmfykmabandkllqodc.supabase.co`
- Test admin login: `info@summitleadsltd.com` / `123456789` (see test_credentials.md)

## Implementation Log — 2026-05-25

### Bugs fixed (web app, `src/`)

| # | Symptom | Root Cause | Fix |
|---|---------|------------|-----|
| 1 | Recordings page crashes/empty | Query references non-existent column `call_recordings.download_url` (migration created the table conditionally; the column was never added in prod) | Removed all `download_url` references in `src/pages/Recordings.tsx` and `src/components/dialer/CallHistoryPanel.tsx`; rely on `recording_url` only. Empty state now shows "No recordings yet — recordings will appear once Telnyx finishes uploading audio." |
| 2 | No pagination (Recordings & CallHistory) | Hardcoded `.limit(500)` / `.limit(1000)` with no UI controls | Added page-size selector (25/50/100) + Prev/Next + total-count via `count: 'exact'` + `.range(offset, offset+pageSize-1)`. Reset to page 0 on filter change. |
| 3 | Appointments missing in tech calendar | `TechnicianCalendar` computed day boundaries with `startOfDay(date).toISOString()` (browser-local) and `isSameDay(...)` (local-tz). Agents in non-ET timezones queried the wrong UTC window. | Added `startOfAppToday()`, `isSameAppDay()` helpers to `src/lib/timezone.ts`; rewrote calendar to use `appDayBounds(estCalendarDay)` for the Supabase query and `isSameAppDay` for the filter. Block-style positioning now uses `toESTDate()` so the time grid lines up with the EST wall clock. |
| 4 | Training Hub not working | Edge function `training-simulation` calls `https://apifreellm.com` whose free tier blocks datacenter IPs ("403 not available from datacenter / cloud IPs"). Page UI works fine; only the LLM call fails. | Patched `supabase/functions/training-simulation/index.ts` and `supabase/functions/ai-call-summary/index.ts` to prefer `OPENAI_API_KEY` (chat completions, `gpt-4o-mini` by default) and fall back to apifreellm. **User must set `OPENAI_API_KEY` in Supabase Edge Function secrets and redeploy both functions for full functionality.** |
| 5 | No contact history in dialer | Downstream of #6 — when no lead is loaded, `activeContactId` is null so the activity/call-history panels just show empty state. | Fixed by #6 — once the dialer surfaces a lead, the existing panels populate correctly. |
| 6 | No daily assigned leads showing | Dialer was calling `useDialerQueue(campaignId)` with no flag, so the `daily_lead_assignments` code path was unreachable. | Refactored `resolveNextLead` to **always try `daily_lead_assignments` first** for the current agent + today (EST), then fall back to `campaign_contacts`. Caller can still pass `{useDailyAssignments:true}` for daily-only mode. Language filter only applied when explicitly requested. |
| 7 | Dialer repeats previously contacted leads | In-memory `recentlyDialedRef` resets on page refresh. No DB-level "already-called-today" exclusion. | Added `last_called_at IS NULL OR last_called_at < estDayStart` filter to both `resolveNextLead` and the `Remaining Today` stats query. Anti-recycle now survives page refresh and is correctly Eastern-day scoped. |
| 8 | CSV exports broken | Filenames built from `range.from.toISOString().slice(0,10)` (UTC date — off-by-one near midnight ET). | Replaced filename date with `appToday()` in Recordings + CallHistory exports. The CSV body already used `formatESTShort()`. Builder already RFC-4180 compliant with UTF-8 BOM. |
| 9 | EST end-to-end | Several spots use UTC/browser-local helpers. | Added `startOfAppToday()`, `isSameAppDay()` to `src/lib/timezone.ts`. Migrated callers: `TechnicianCalendar`, `Recordings`, `CallHistory`, `LeadAssignment`. Existing `CallerIdPoolDashboard` already used `appToday()` correctly. |

### Files Modified
- `src/lib/timezone.ts` — added `startOfAppToday()`, `isSameAppDay()` helpers
- `src/hooks/use-dialer-queue.ts` — daily-assignments first + EST per-day exclusion
- `src/pages/TechnicianCalendar.tsx` — EST day bounds, EST-aware filtering & block positioning
- `src/pages/Recordings.tsx` — removed `download_url`, added pagination + count, EST filename
- `src/pages/CallHistory.tsx` — added pagination + count, EST filename, removed `download_url`
- `src/components/dialer/CallHistoryPanel.tsx` — removed `download_url` reference
- `src/pages/LeadAssignment.tsx` — replaced UTC `today` with `appToday()`
- `supabase/functions/training-simulation/index.ts` — OpenAI preferred + apifreellm fallback
- `supabase/functions/ai-call-summary/index.ts` — OpenAI preferred + apifreellm fallback
- `vite.config.ts` — bound to port 3000 / host 0.0.0.0 / allowedHosts for preview
- `.env` — VITE_SUPABASE_* + VITE_LIVEKIT_URL
- `frontend/package.json` — shim so supervisor's `cd /app/frontend && yarn start` runs Vite from `/app`

### What is NOT yet done (deferred)
- **OPENAI_API_KEY**: Must be added in Supabase dashboard → Edge Functions → Settings → Secrets, then redeploy `training-simulation` and `ai-call-summary`. Until then those features still 403.
- **Mobile (`technician-mobile/`)**: User said "web first" — Capacitor + Expo apps not touched. EST sweep there is a follow-up.
- **Schema repair**: `download_url` column on `call_recordings` is missing. Code no longer relies on it, but if Telnyx ever needs to write a download URL, add the column via migration.
- **Recordings ingestion**: `call_recordings` table is empty in prod. Indicates Telnyx-LiveKit webhook isn't writing rows — separate operational issue.
- **Lint cleanup**: 52 pre-existing `no-explicit-any` issues in the touched files (not introduced by this session).

### Next Action Items
1. Add `OPENAI_API_KEY` in Supabase Edge Function secrets (and optionally `OPENAI_MODEL`, defaults to `gpt-4o-mini`).
2. Redeploy `training-simulation` and `ai-call-summary` via Lovable Publish / supabase functions deploy.
3. (Optional) Add migration to create `download_url TEXT` on `call_recordings` if you intend to populate it later from Telnyx.
4. Sweep mobile (`technician-mobile/`) for the same UTC/local-tz patterns.
5. Investigate why `call_recordings` is empty — verify LiveKit webhook → call_recordings insert path.

### Future / Backlog (P1)
- Server-side full-text search on Contacts (currently client-side once page is loaded)
- Bulk operations on Recordings/Contacts pages
- Date-range presets for "This week (ET)" / "Last week (ET)"

### Future / Backlog (P2)
- Real-time appointment updates on the technician calendar (Supabase Realtime channel)
- Lighthouse pass on lazy-loaded routes (PWA manifest is already correct)
- Bring tests in `src/test/` back to green after EST refactor

### Smart Enhancement Idea
Now that the EST queue exclusion is in place, you can layer a **"missed-call call-back priority lane"**: any lead whose only attempt today ended in `voicemail/no_answer` could automatically be re-prioritised to the top of the next operating day's queue. Pair with an SMS auto-reply ("We tried to reach you — call us back at …") and you'll convert ~10-15% of unanswered first attempts. Two new columns + a small change in `resolveNextLead`'s sort would do it.
