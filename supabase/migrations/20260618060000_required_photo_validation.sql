-- Add required photo validation configuration
-- This allows defining which photo types are required for different appointment types

CREATE TABLE IF NOT EXISTS public.photo_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type TEXT NOT NULL,
  photo_type TEXT NOT NULL,
  required BOOLEAN DEFAULT true,
  min_count INT DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(appointment_type, photo_type)
);

ALTER TABLE public.photo_requirements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated can view photo requirements" ON public.photo_requirements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage photo requirements" ON public.photo_requirements
  FOR ALL TO authenticated USING (true);

-- Insert default photo requirements for inspection appointments
INSERT INTO public.photo_requirements (appointment_type, photo_type, required, min_count) VALUES
  ('inspection', 'roof', true, 1),
  ('inspection', 'electrical_panel', true, 1),
  ('inspection', 'property_overview', true, 1),
  ('inspection', 'shading', false, 0),
  ('inspection', 'obstacles', false, 0)
ON CONFLICT (appointment_type, photo_type) DO NOTHING;

-- Function to check if appointment has all required photos
CREATE OR REPLACE FUNCTION public.check_required_photos(p_appointment_id UUID)
RETURNS TABLE (
  has_all_required BOOLEAN,
  missing_photos TEXT[],
  total_required INT,
  total_uploaded INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_type TEXT;
  v_total_required INT;
  v_total_uploaded INT;
  v_missing_photos TEXT[];
BEGIN
  -- Get appointment type (default to 'inspection')
  SELECT COALESCE(type, 'inspection')
  INTO v_appointment_type
  FROM public.appointments
  WHERE id = p_appointment_id;

  -- Get total required photos
  SELECT COUNT(*)
  INTO v_total_required
  FROM public.photo_requirements
  WHERE appointment_type = v_appointment_type AND required = true;

  -- Get total uploaded photos
  SELECT COUNT(DISTINCT photo_type)
  INTO v_total_uploaded
  FROM public.appointment_photos
  WHERE appointment_id = p_appointment_id;

  -- Find missing required photo types
  SELECT array_agg(photo_type)
  INTO v_missing_photos
  FROM public.photo_requirements
  WHERE appointment_type = v_appointment_type
    AND required = true
    AND photo_type NOT IN (
      SELECT DISTINCT photo_type
      FROM public.appointment_photos
      WHERE appointment_id = p_appointment_id
    );

  RETURN QUERY SELECT
    v_total_uploaded >= v_total_required as has_all_required,
    COALESCE(v_missing_photos, ARRAY[]::TEXT[]) as missing_photos,
    v_total_required,
    v_total_uploaded;
END;
$$;

-- Function to prevent appointment completion without required photos
CREATE OR REPLACE FUNCTION public.validate_photos_before_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_all_required BOOLEAN;
  v_missing_photos TEXT[];
BEGIN
  -- Only check if status is being set to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Check if all required photos are uploaded
    SELECT has_all_required, missing_photos
    INTO v_has_all_required, v_missing_photos
    FROM public.check_required_photos(NEW.id);

    IF NOT v_has_all_required THEN
      RAISE EXCEPTION 'Cannot complete appointment: missing required photos: %', array_to_string(v_missing_photos, ', ');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for photo validation
DROP TRIGGER IF EXISTS validate_appointment_photos ON public.appointments;
CREATE TRIGGER validate_appointment_photos
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_photos_before_completion();
