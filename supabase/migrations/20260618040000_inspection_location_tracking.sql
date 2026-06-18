-- Add GPS and time tracking to appointment_outcomes table
-- This allows tracking when inspections started, completed, and where they occurred

ALTER TABLE public.appointment_outcomes
ADD COLUMN IF NOT EXISTS inspection_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS inspection_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS inspection_duration_minutes INT,
ADD COLUMN IF NOT EXISTS inspection_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS inspection_longitude NUMERIC,
ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC;

-- Add comments to document the new fields
COMMENT ON COLUMN public.appointment_outcomes.inspection_started_at IS 'Timestamp when technician started the inspection';
COMMENT ON COLUMN public.appointment_outcomes.inspection_completed_at IS 'Timestamp when technician completed the inspection';
COMMENT ON COLUMN public.appointment_outcomes.inspection_duration_minutes IS 'Total inspection duration in minutes';
COMMENT ON COLUMN public.appointment_outcomes.inspection_latitude IS 'GPS latitude where inspection occurred';
COMMENT ON COLUMN public.appointment_outcomes.inspection_longitude IS 'GPS longitude where inspection occurred';
COMMENT ON COLUMN public.appointment_outcomes.location_accuracy IS 'GPS accuracy in meters';

-- Create indexes for location-based queries
CREATE INDEX IF NOT EXISTS idx_outcomes_latitude ON public.appointment_outcomes(inspection_latitude) WHERE inspection_latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outcomes_longitude ON public.appointment_outcomes(inspection_longitude) WHERE inspection_longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outcomes_inspection_time ON public.appointment_outcomes(inspection_started_at) WHERE inspection_started_at IS NOT NULL;
