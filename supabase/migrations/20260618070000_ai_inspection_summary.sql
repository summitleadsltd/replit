-- Add AI-generated inspection summary field
-- This allows storing AI-generated summaries from inspection data

ALTER TABLE public.appointment_outcomes
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_summary_model TEXT;

-- Add comments to document the new fields
COMMENT ON COLUMN public.appointment_outcomes.ai_summary IS 'AI-generated summary of inspection findings';
COMMENT ON COLUMN public.appointment_outcomes.ai_summary_generated_at IS 'Timestamp when AI summary was generated';
COMMENT ON COLUMN public.appointment_outcomes.ai_summary_model IS 'AI model used to generate the summary';
