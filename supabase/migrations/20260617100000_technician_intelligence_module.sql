-- Technician Intelligence & Route Optimization Module
-- Created: 2026-06-17
-- Purpose: Add technician territories, location tracking, inspection outcomes, and photo management

-- ============================================================================
-- Phase 1: Expand appointment_status enum for technician workflow
-- ============================================================================

-- Extend existing appointment_status enum with technician workflow statuses
-- (booked, confirmed, rescheduled, completed, no_show, replaced already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'scheduled' AND enumtypid = 'public.appointment_status'::regtype) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'scheduled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'on_route' AND enumtypid = 'public.appointment_status'::regtype) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'on_route';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'arrived' AND enumtypid = 'public.appointment_status'::regtype) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'arrived';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'in_progress' AND enumtypid = 'public.appointment_status'::regtype) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'in_progress';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'inspection_complete' AND enumtypid = 'public.appointment_status'::regtype) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'inspection_complete';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cancelled' AND enumtypid = 'public.appointment_status'::regtype) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'cancelled';
  END IF;
END $$;

-- ============================================================================
-- Phase 2: Create technician_territories table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.technician_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  zip_code VARCHAR(10) NOT NULL,
  county TEXT,
  priority INT DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(technician_id, zip_code)
);

ALTER TABLE public.technician_territories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for technician_territories
CREATE POLICY "Authenticated can view territories" ON public.technician_territories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage territories" ON public.technician_territories
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for technician_territories
CREATE INDEX idx_territories_technician ON public.technician_territories(technician_id);
CREATE INDEX idx_territories_zip ON public.technician_territories(zip_code);
CREATE INDEX idx_territories_active ON public.technician_territories(active);

-- Trigger for updated_at
CREATE TRIGGER update_territories_updated_at
  BEFORE UPDATE ON public.technician_territories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Phase 3: Create technician_location_history table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.technician_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(5, 2),
  heading DECIMAL(5, 2),
  battery_level INT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.technician_location_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for technician_location_history
CREATE POLICY "Technicians can view own location history" ON public.technician_location_history
  FOR SELECT TO authenticated USING (
    technician_id IN (
      SELECT id FROM public.technicians WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Technicians can insert own location history" ON public.technician_location_history
  FOR INSERT TO authenticated WITH CHECK (
    technician_id IN (
      SELECT id FROM public.technicians WHERE user_id = auth.uid()
    )
  );

-- Indexes for technician_location_history
CREATE INDEX idx_location_history_technician ON public.technician_location_history(technician_id);
CREATE INDEX idx_location_history_captured_at ON public.technician_location_history(captured_at DESC);
CREATE INDEX idx_location_history_geospatial ON public.technician_location_history USING GIST (point(longitude, latitude));

-- Auto-cleanup: Delete location history older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_location_history()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.technician_location_history
  WHERE captured_at < now() - interval '30 days';
END;
$$;

-- ============================================================================
-- Phase 4: Create appointment_outcomes table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.appointment_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.technicians(id),
  
  -- Property Information
  roof_type TEXT,
  roof_age INT,
  panel_size TEXT,
  shading TEXT,
  electrical_condition TEXT,
  
  -- Inspection Result
  outcome TEXT CHECK (outcome IN ('qualified', 'not_qualified', 'needs_follow_up', 'engineering_review')),
  
  -- Next Steps
  next_step TEXT CHECK (next_step IN ('schedule_proposal', 'permit_review', 'engineering_visit', 'installation', 'call_back', 'no_action')),
  
  notes TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_outcomes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appointment_outcomes
CREATE POLICY "Authenticated can view outcomes" ON public.appointment_outcomes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Technicians can insert outcomes" ON public.appointment_outcomes
  FOR INSERT TO authenticated WITH CHECK (
    technician_id IN (
      SELECT id FROM public.technicians WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Technicians can update own outcomes" ON public.appointment_outcomes
  FOR UPDATE TO authenticated USING (
    technician_id IN (
      SELECT id FROM public.technicians WHERE user_id = auth.uid()
    )
  );

-- Indexes for appointment_outcomes
CREATE INDEX idx_outcomes_appointment ON public.appointment_outcomes(appointment_id);
CREATE INDEX idx_outcomes_technician ON public.appointment_outcomes(technician_id);
CREATE INDEX idx_outcomes_outcome ON public.appointment_outcomes(outcome);

-- ============================================================================
-- Phase 5: Create appointment_photos table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.appointment_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.technicians(id),
  
  -- Photo categorization
  photo_type TEXT CHECK (photo_type IN (
    'before_front_elevation',
    'before_rear_elevation',
    'before_roof_front',
    'before_roof_rear',
    'before_meter',
    'before_electrical_panel',
    'during_damage',
    'during_shading_issues',
    'during_structural_issues',
    'during_safety_concerns',
    'after_completed_inspection',
    'after_customer_signature',
    'after_additional_notes'
  )),
  
  photo_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appointment_photos
CREATE POLICY "Authenticated can view photos" ON public.appointment_photos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Technicians can insert photos" ON public.appointment_photos
  FOR INSERT TO authenticated WITH CHECK (
    technician_id IN (
      SELECT id FROM public.technicians WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Technicians can delete own photos" ON public.appointment_photos
  FOR DELETE TO authenticated USING (
    technician_id IN (
      SELECT id FROM public.technicians WHERE user_id = auth.uid()
    )
  );

-- Indexes for appointment_photos
CREATE INDEX idx_photos_appointment ON public.appointment_photos(appointment_id);
CREATE INDEX idx_photos_technician ON public.appointment_photos(technician_id);
CREATE INDEX idx_photos_type ON public.appointment_photos(photo_type);

-- ============================================================================
-- Phase 6: Storage bucket for appointment photos
-- ============================================================================

-- Create storage bucket for appointment photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('appointment-photos', 'appointment-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for appointment photos
CREATE POLICY "Technicians can upload photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'appointment-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR auth.uid()::text = (storage.foldername(name))[2]  -- technician_id in path
    )
  );

CREATE POLICY "Authenticated can view photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'appointment-photos');

CREATE POLICY "Users can delete own photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'appointment-photos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR owner_id = auth.uid()::text
    )
  );

-- ============================================================================
-- Phase 7: Helper functions for technician assignment
-- ============================================================================

-- Function: Get technician by ZIP code
CREATE OR REPLACE FUNCTION public.get_technician_by_zip(zip_code VARCHAR)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT technician_id 
  FROM public.technician_territories
  WHERE zip_code = $1
    AND active = true
  LIMIT 1;
$$;

-- Function: Score technicians for appointment assignment
CREATE OR REPLACE FUNCTION public.score_technicians_for_assignment(
  p_zip_code VARCHAR,
  p_appointment_at TIMESTAMPTZ
)
RETURNS TABLE (
  technician_id UUID,
  territory_match INT,
  availability_score INT,
  total_score INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH territory_scores AS (
    SELECT 
      t.id as technician_id,
      CASE 
        WHEN tt.zip_code = p_zip_code THEN 40
        ELSE 0
      END as territory_match
    FROM public.technicians t
    LEFT JOIN public.technician_territories tt ON tt.technician_id = t.id AND tt.active = true
    WHERE t.is_active = true
  ),
  availability_scores AS (
    SELECT 
      ta.technician_id,
      CASE 
        WHEN NOT EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.technician_id = ta.technician_id
            AND a.appointment_at BETWEEN p_appointment_at - interval '2 hours' AND p_appointment_at + interval '2 hours'
            AND a.status NOT IN ('cancelled', 'completed', 'no_show')
        ) THEN 25
        ELSE 0
      END as availability_score
    FROM public.technician_availability ta
    WHERE ta.date = DATE(p_appointment_at)
      AND ta.is_available = true
  )
  SELECT 
    COALESCE(ts.technician_id, av.technician_id) as technician_id,
    COALESCE(ts.territory_match, 0) as territory_match,
    COALESCE(av.availability_score, 0) as availability_score,
    COALESCE(ts.territory_match, 0) + COALESCE(av.availability_score, 0) as total_score
  FROM territory_scores ts
  FULL OUTER JOIN availability_scores av ON ts.technician_id = av.technician_id
  WHERE COALESCE(ts.territory_match, 0) + COALESCE(av.availability_score, 0) > 0
  ORDER BY total_score DESC
  LIMIT 5;
$$;

-- ============================================================================
-- Phase 8: Trigger for automatic technician assignment based on ZIP
-- ============================================================================

-- Function: Auto-assign technician to appointment based on ZIP code
CREATE OR REPLACE FUNCTION public.auto_assign_technician()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_technician_id UUID;
BEGIN
  -- Only auto-assign if no technician is assigned and appointment has a contact with ZIP
  IF NEW.technician_id IS NULL THEN
    -- Get ZIP from contact
    SELECT c.zip_code INTO v_technician_id
    FROM public.contacts c
    WHERE c.id = NEW.contact_id;
    
    -- If we have a ZIP, find the best technician
    IF v_technician_id IS NOT NULL THEN
      SELECT technician_id INTO v_technician_id
      FROM public.score_technicians_for_assignment(v_technician_id, NEW.appointment_at)
      ORDER BY total_score DESC
      LIMIT 1;
      
      -- Assign the technician
      IF v_technician_id IS NOT NULL THEN
        NEW.technician_id = v_technician_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-assignment
DROP TRIGGER IF EXISTS on_appointment_insert_auto_assign ON public.appointments;
CREATE TRIGGER on_appointment_insert_auto_assign
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_technician();

-- ============================================================================
-- Phase 9: Enable realtime for new tables
-- ============================================================================

ALTER TABLE public.technician_location_history REPLICA IDENTITY FULL;
ALTER TABLE public.appointment_outcomes REPLICA IDENTITY FULL;
ALTER TABLE public.appointment_photos REPLICA IDENTITY FULL;

-- ============================================================================
-- Phase 10: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE public.technician_territories IS 'Maps technicians to their service territory ZIP codes';
COMMENT ON TABLE public.technician_location_history IS 'GPS location history for technicians (auto-cleanup after 30 days)';
COMMENT ON TABLE public.appointment_outcomes IS 'Inspection results and next steps for appointments';
COMMENT ON TABLE public.appointment_photos IS 'Photos taken during inspections, categorized by type';

COMMENT ON FUNCTION public.get_technician_by_zip IS 'Returns the primary technician for a given ZIP code';
COMMENT ON FUNCTION public.score_technicians_for_assignment IS 'Scores technicians for appointment assignment based on territory, availability, and other factors';
COMMENT ON FUNCTION public.auto_assign_technician IS 'Automatically assigns technicians to appointments based on ZIP code matching';
