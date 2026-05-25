-- Remove "Have Solar" disposition and add new ones:
-- "Not Single Family Dwelling", "Spanish", "New Roof"

-- Deactivate "Have Solar" (keep row for historical call_attempts that reference it)
UPDATE public.dispositions SET active = false WHERE code = 'have_solar';

-- Insert new dispositions (use ON CONFLICT to avoid errors if already exist)
INSERT INTO public.dispositions (label, code, requires_callback_datetime, requires_appointment_modal, active, sort_order)
VALUES
  ('Not Single Family Dwelling', 'not_single_family', false, false, true, 8),
  ('Spanish', 'spanish', false, false, true, 9),
  ('New Roof', 'new_roof', false, false, true, 10)
ON CONFLICT (code) DO UPDATE SET
  active = true,
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;
