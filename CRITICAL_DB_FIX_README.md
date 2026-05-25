# Apply this NOW in Supabase SQL Editor

## Why
Your `call_attempts` table currently rejects every insert with:
```
ERROR  42703  record "new" has no field "telnyx_call_control_id"
```
because of a trigger function that references columns that don't exist in
your production schema. That single bug is the root cause of:
- `call_attempts` table being empty
- `call_recordings` table being empty (recordings require a call_attempt_id)
- Recording counters on the dashboard reading 0%
- "No Recordings yet" on the Recordings page
- AI Call Summaries never running on completed calls

The dialer's `campaign_contacts.attempts` counter increments via a separate
`UPDATE` so the dashboard makes it look like calls are happening — but every
`INSERT INTO call_attempts` has been silently dropped on the floor.

## What to do (~30 seconds, no risk)
1. Open Supabase dashboard → SQL Editor → New query
2. Paste the SQL from `/app/supabase/migrations/20260525000000_fix_call_attempts_trigger.sql`
   (also reproduced below)
3. Click **Run**
4. Smoke-test by making one call through the dialer — you should see a fresh
   row in `call_attempts` and the dashboard "Calls Today" should increment.

## Optional verification query
After running the migration, run this to confirm the trigger function no
longer references missing columns:
```sql
SELECT pg_get_functiondef('public.validate_call_attempt_link'::regprocedure);
```
You should see the new body (it references only `telnyx_call_id`, never
`telnyx_call_control_id` or `telnyx_call_session_id`).

## SQL (paste this whole block)
```sql
DROP TRIGGER IF EXISTS trg_validate_call_attempt_link ON public.call_attempts;

CREATE OR REPLACE FUNCTION public.validate_call_attempt_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Require campaign linkage unless this is an explicit manual/ad-hoc dial.
  IF NEW.campaign_id IS NULL
     AND COALESCE(NEW.call_source, 'queue') NOT IN ('manual', 'manual_dial', 'ad_hoc') THEN
    RAISE EXCEPTION
      'call_attempts.campaign_id is required (call_source=%)',
      COALESCE(NEW.call_source, 'queue')
      USING ERRCODE = '23514';
  END IF;

  -- LiveKit/queue-sourced calls are accepted without a Telnyx ID — the
  -- webhook fills in telnyx_call_id later if/when Telnyx is the carrier.
  IF COALESCE(NEW.provider_used, 'livekit') = 'telnyx'
     AND NEW.telnyx_call_id IS NULL THEN
    RAISE EXCEPTION
      'Telnyx-sourced call_attempts must include telnyx_call_id'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_call_attempt_link
BEFORE INSERT ON public.call_attempts
FOR EACH ROW EXECUTE FUNCTION public.validate_call_attempt_link();
```

## After the fix
- New calls will populate `call_attempts` correctly
- Recordings will start landing in `call_recordings` (once Telnyx finishes
  uploading the audio for each completed call)
- AI Call Summary will run on completed calls (assuming `OPENAI_API_KEY` is
  also configured — separate task)

If you'd rather use the CLI:
```
supabase db push  # picks up the new migration file automatically
```
