-- Add time range fields to technician_availability table
-- This allows technicians to specify specific hours within a day when they're unavailable

ALTER TABLE public.technician_availability
ADD COLUMN IF NOT EXISTS unavailable_start_time TIME,
ADD COLUMN IF NOT EXISTS unavailable_end_time TIME;

-- Add comment to document the new fields
COMMENT ON COLUMN public.technician_availability.unavailable_start_time IS 'Start time of unavailability window (if partial day)';
COMMENT ON COLUMN public.technician_availability.unavailable_end_time IS 'End time of unavailability window (if partial day)';
