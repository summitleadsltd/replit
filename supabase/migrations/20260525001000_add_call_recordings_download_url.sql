-- 2026-05-25 — Add download_url to call_recordings
--
-- Originally part of `20260514107000_ensure_call_recordings_table.sql`,
-- but that migration was idempotent only on table creation (`CREATE TABLE
-- IF NOT EXISTS`) so when the table already existed the new columns were
-- never added. This patch adds the missing column explicitly.
--
-- `download_url` stores a long-lived, downloadable URL (e.g. Telnyx's
-- post-call recording URL or a signed Supabase Storage URL). `recording_url`
-- continues to hold the streaming/short-lived URL used during playback.

ALTER TABLE public.call_recordings
  ADD COLUMN IF NOT EXISTS download_url TEXT;

COMMENT ON COLUMN public.call_recordings.download_url IS
  'Long-lived downloadable URL (Telnyx recording URL or signed storage URL). The streaming/playback URL lives in recording_url.';
