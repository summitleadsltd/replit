-- Fix confirmation_status CHECK constraint on appointments table.
-- The first migration used ('scheduled','confirmed','unable_to_reach','cancelled','rescheduled')
-- but the UI code uses ('pending','confirmed','failed_to_reach','rescheduled','cancelled').
-- Unify to support ALL values used across the codebase.

-- Drop old check constraints (names may vary)
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_confirmation_status_check;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_confirmation_status_check1;

-- Set default to 'pending' and allow all used values
ALTER TABLE public.appointments
  ALTER COLUMN confirmation_status SET DEFAULT 'pending';

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_confirmation_status_check
    CHECK (confirmation_status IN (
      'pending', 'scheduled', 'confirmed',
      'unable_to_reach', 'failed_to_reach',
      'cancelled', 'rescheduled'
    ));

-- Update any 'scheduled' rows to 'pending' for consistency
UPDATE public.appointments
  SET confirmation_status = 'pending'
  WHERE confirmation_status = 'scheduled';
