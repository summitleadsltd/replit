-- 2026-05-25 — Fix broken call_attempts insert trigger
--
-- Problem
-- -------
-- A previous migration installed `trg_validate_call_attempt_link` whose
-- function `validate_call_attempt_link()` references three NEW columns:
--   NEW.telnyx_call_id, NEW.telnyx_call_control_id, NEW.telnyx_call_session_id
--
-- In production the table only has `telnyx_call_id`. The other two columns
-- never existed (or were dropped), so Postgres raises:
--     ERROR  42703  record "new" has no field "telnyx_call_control_id"
-- on EVERY insert into call_attempts. The frontend's `.insert(...).single()`
-- swallows the error silently, which is why `call_attempts` (and therefore
-- `call_recordings`) is empty even though the dialer increments
-- `campaign_contacts.attempts` and `last_called_at` independently.
--
-- Additionally, the dialer is LiveKit-based (`provider_used = 'livekit'`)
-- and never sends Telnyx IDs from the agent side, so even after adding the
-- missing columns the trigger would still reject every queue insert.
--
-- Fix
-- ---
-- 1. Recreate `validate_call_attempt_link()` so it only references columns
--    that actually exist, and only enforces a provider linkage when the
--    call_source is Telnyx-only.
-- 2. LiveKit-sourced calls are accepted unconditionally — the
--    livekit_call_id (if/when added) or telnyx_call_id may be filled
--    asynchronously by the webhook.

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
  -- For pure Telnyx-control-plane calls, require telnyx_call_id.
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

-- Smoke test (optional — remove if migration runner doesn't like SELECTs):
-- INSERT INTO public.call_attempts
--   (contact_id, campaign_id, disposition, started_at, ended_at,
--    duration_seconds, call_source, dial_mode_used, provider_used, outcome)
-- SELECT
--   (SELECT id FROM public.contacts LIMIT 1),
--   (SELECT id FROM public.campaigns LIMIT 1),
--   'no_answer', now(), now(), 0, 'queue', 'queue', 'livekit', 'no_answer';
