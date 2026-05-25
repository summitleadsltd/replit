-- Technician App Schema Migration
-- Created: 2026-05-13
-- Purpose: Add job cards table and extend appointment_status enum for mobile field app
-- NOTE: technicians table already exists from 20260506193037 migration

-- ============================================================================
-- Phase 1: Extend appointment_status enum for technician mobile app
-- ============================================================================

-- Extend existing appointment_status enum with technician workflow statuses
-- (booked, confirmed, rescheduled, completed, no_show, replaced already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'on_route' AND enumtypid = 'public.appointment_status'::regtype) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'on_route';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'in_progress' AND enumtypid = 'public.appointment_status'::regtype) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'in_progress';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sale' AND enumtypid = 'public.appointment_status'::regtype) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'sale';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cancelled' AND enumtypid = 'public.appointment_status'::regtype) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'cancelled';
  END IF;
END $$;

-- ============================================================================
-- Phase 2: Extend Appointments for Technicians
-- ============================================================================

-- Add technician_id to existing appointments table for simple linking
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES public.technicians(id);

-- Index for technician lookups
CREATE INDEX IF NOT EXISTS idx_appointments_technician ON public.appointments(technician_id);
CREATE INDEX IF NOT EXISTS idx_appointments_technician_status ON public.appointments(technician_id, status);

-- RLS: Allow technicians to update their assigned appointments, managers to view all
-- Note: Managers use app_role from profiles, not technician table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointments' AND policyname='Technicians can update assigned appointments'
  ) THEN
    CREATE POLICY "Technicians can update assigned appointments"
      ON public.appointments
      FOR UPDATE
      TO authenticated
      USING (
        technician_id IN (
          SELECT t.id FROM public.technicians t WHERE t.user_id = auth.uid()
        )
        OR
        has_role(auth.uid(), 'admin'::app_role)
        OR
        has_role(auth.uid(), 'manager'::app_role)
      );
  END IF;
END $$;

-- RLS: Allow technicians to view their assigned appointments, managers to view all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointments' AND policyname='Technicians and managers can view appointments'
  ) THEN
    CREATE POLICY "Technicians and managers can view appointments"
      ON public.appointments
      FOR SELECT
      TO authenticated
      USING (
        technician_id IN (
          SELECT t.id FROM public.technicians t WHERE t.user_id = auth.uid()
        )
        OR
        has_role(auth.uid(), 'admin'::app_role)
        OR
        has_role(auth.uid(), 'manager'::app_role)
        OR
        -- Also allow viewing appointments with no technician assigned (for assignment)
        technician_id IS NULL
      );
  END IF;
END $$;

-- ============================================================================
-- Phase 3: Create Job Cards Table (if not exists)
-- ============================================================================

-- NOTE: job_cards table may already exist from 20260509 migration
-- This conditional creation prevents errors
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_cards') THEN
    CREATE TABLE public.job_cards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
      technician_id UUID NOT NULL REFERENCES public.technicians(id),
      project_notes TEXT,
      installation_details JSONB DEFAULT '{}',
      photos JSONB DEFAULT '[]',
      signature_url TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'sale', 'cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- Enable RLS
    ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
    
    -- Indexes for job_cards
    CREATE INDEX idx_job_cards_appointment ON public.job_cards(appointment_id);
    CREATE INDEX idx_job_cards_technician ON public.job_cards(technician_id);
    CREATE INDEX idx_job_cards_status ON public.job_cards(status);
    
    -- Trigger for updated_at
    CREATE TRIGGER update_job_cards_updated_at
      BEFORE UPDATE ON public.job_cards
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- Phase 3b: Add technician_id to existing job_cards table
-- ============================================================================

-- Add technician_id column to existing job_cards (if table already exists without it)
DO $$
BEGIN
  -- If job_cards exists but doesn't have technician_id, add it
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_cards'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'job_cards' AND column_name = 'technician_id'
  ) THEN
    -- Add nullable technician_id column
    ALTER TABLE public.job_cards 
      ADD COLUMN technician_id UUID REFERENCES public.technicians(id);
    
    -- Add index for the new column
    CREATE INDEX IF NOT EXISTS idx_job_cards_technician ON public.job_cards(technician_id);
  END IF;
END $$;

-- RLS Policies for job_cards (only if technician_id column exists)
DO $$
BEGIN
  -- Only create policies if technician_id column exists (our schema version)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'job_cards' AND column_name = 'technician_id'
  ) THEN
    -- Technicians can view own job cards, managers can view all
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'job_cards' AND policyname = 'Technicians and managers can view job cards'
    ) THEN
      EXECUTE 'CREATE POLICY "Technicians and managers can view job cards"
        ON public.job_cards
        FOR SELECT
        TO authenticated
        USING (
          technician_id IN (
            SELECT id FROM public.technicians WHERE user_id = auth.uid()
          )
          OR has_role(auth.uid(), ''admin''::app_role)
          OR has_role(auth.uid(), ''manager''::app_role)
        )';
    END IF;
    
    -- Technicians can create job cards
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'job_cards' AND policyname = 'Technicians can create job cards for their appointments'
    ) THEN
      EXECUTE 'CREATE POLICY "Technicians can create job cards for their appointments"
        ON public.job_cards
        FOR INSERT
        TO authenticated
        WITH CHECK (technician_id IN (
          SELECT id FROM public.technicians WHERE user_id = auth.uid()
        ))';
    END IF;
    
    -- Technicians can update own job cards
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'job_cards' AND policyname = 'Technicians can update own job cards'
    ) THEN
      EXECUTE 'CREATE POLICY "Technicians can update own job cards"
        ON public.job_cards
        FOR UPDATE
        TO authenticated
        USING (technician_id IN (
          SELECT id FROM public.technicians WHERE user_id = auth.uid()
        ))';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- Phase 4: Helper Functions
-- ============================================================================

-- Function: Get technician ID for current user
CREATE OR REPLACE FUNCTION public.get_current_technician_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.technicians WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Function: Check if current user is a technician
CREATE OR REPLACE FUNCTION public.is_technician()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.technicians WHERE user_id = auth.uid()
  );
$$;

-- Function: Check if current user is a manager/supervisor
-- Managers have roles: admin, manager
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON ur.user_id = p.user_id
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'manager')
    AND p.is_active = true
  );
$$;

-- Function: Check if user can manage specific technician
-- Returns true if manager in same company OR is the technician themselves
CREATE OR REPLACE FUNCTION public.can_manage_technician(tech_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- User is the technician
    EXISTS (SELECT 1 FROM public.technicians WHERE id = tech_id AND user_id = auth.uid())
    OR
    -- User is a manager in the same company as the technician
    EXISTS (
      SELECT 1 FROM public.technicians t
      JOIN public.profiles p ON p.user_id = auth.uid()
      JOIN public.user_roles ur ON ur.user_id = auth.uid()
      WHERE t.id = tech_id
      AND t.company_id = p.company_id
      AND ur.role IN ('admin', 'manager')
      AND p.is_active = true
    );
$$;

-- ============================================================================
-- Phase 5: Trigger - Auto-create job card on sale status
-- ============================================================================

-- NOTE: Only create trigger if job_cards table has the expected columns
DO $$
BEGIN
  -- Check if job_cards table exists and has technician_id column (our schema)
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_cards'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'job_cards' AND column_name = 'technician_id'
  ) THEN
    -- Drop trigger first if exists (must drop before recreating function)
    EXECUTE 'DROP TRIGGER IF EXISTS on_appointment_status_to_sale ON public.appointments';
    
    -- Create the function and trigger for our schema
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION public.handle_appointment_sale_status()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $inner$
      BEGIN
        -- When appointment status changes to 'sale', create a job card if not exists
        -- Use ::text comparison to avoid "unsafe use of new enum value" error
        IF NEW.status::text = 'sale' AND OLD.status::text IS DISTINCT FROM 'sale' THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.job_cards WHERE appointment_id = NEW.id
          ) THEN
            INSERT INTO public.job_cards (appointment_id, technician_id, status)
            VALUES (NEW.id, NEW.technician_id, 'pending');
          END IF;
        END IF;
        
        RETURN NEW;
      END;
      $inner$;
    $func$;

    EXECUTE $trig$
      CREATE TRIGGER on_appointment_status_to_sale
        AFTER UPDATE ON public.appointments
        FOR EACH ROW
        WHEN (NEW.status::text = 'sale')
        EXECUTE FUNCTION public.handle_appointment_sale_status()
    $trig$;
  END IF;
END $$;

-- ============================================================================
-- Phase 6: Additional Tables from Guide
-- ============================================================================

-- Technician Availability Table (for scheduling)
CREATE TABLE IF NOT EXISTS public.technician_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(technician_id, date)
);

ALTER TABLE public.technician_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Technicians can manage own availability" ON public.technician_availability;
CREATE POLICY "Technicians can manage own availability"
  ON public.technician_availability
  FOR ALL
  TO authenticated
  USING (technician_id IN (
    SELECT t.id FROM public.technicians t WHERE t.user_id = auth.uid()
  ))
  WITH CHECK (technician_id IN (
    SELECT t.id FROM public.technicians t WHERE t.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Authenticated can view availability" ON public.technician_availability;
CREATE POLICY "Authenticated can view availability"
  ON public.technician_availability
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_tech_availability_tech ON public.technician_availability(technician_id, date);

DROP TRIGGER IF EXISTS update_tech_availability_updated_at ON public.technician_availability;
CREATE TRIGGER update_tech_availability_updated_at
  BEFORE UPDATE ON public.technician_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Appointment Status History (audit trail)
CREATE TABLE IF NOT EXISTS public.appointment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view status history" ON public.appointment_status_history;
CREATE POLICY "Authenticated can view status history"
  ON public.appointment_status_history
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Technicians can add status history" ON public.appointment_status_history;
CREATE POLICY "Technicians can add status history"
  ON public.appointment_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index only if table has created_at column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'appointment_status_history' AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_status_history_appt ON public.appointment_status_history(appointment_id, created_at);
  END IF;
END $$;

-- Trigger to auto-log status changes
-- NOTE: This function uses ::text comparisons to avoid enum value issues
CREATE OR REPLACE FUNCTION public.log_appointment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status::text IS DISTINCT FROM NEW.status::text THEN
    INSERT INTO public.appointment_status_history (
      appointment_id,
      previous_status,
      new_status,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      OLD.status::text,
      NEW.status::text,
      auth.uid(),
      NEW.notes
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_appointment_status_change ON public.appointments;
CREATE TRIGGER on_appointment_status_change
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_appointment_status_change();

-- Job Card Images Table (links to storage bucket)
CREATE TABLE IF NOT EXISTS public.job_card_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_card_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Technicians and managers can view job card images" ON public.job_card_images;
CREATE POLICY "Technicians and managers can view job card images"
  ON public.job_card_images
  FOR SELECT
  TO authenticated
  USING (
    job_card_id IN (
      SELECT jc.id FROM public.job_cards jc
      WHERE jc.technician_id IN (
        SELECT t.id FROM public.technicians t WHERE t.user_id = auth.uid()
      )
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

DROP POLICY IF EXISTS "Technicians can upload images" ON public.job_card_images;
CREATE POLICY "Technicians can upload images"
  ON public.job_card_images
  FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Technicians can delete own images" ON public.job_card_images;
CREATE POLICY "Technicians can delete own images"
  ON public.job_card_images
  FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_job_card_images_job ON public.job_card_images(job_card_id);

-- ============================================================================
-- Phase 7: Storage Bucket Setup with Folder Isolation
-- ============================================================================

-- Create storage bucket for job card images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('job-card-images', 'job-card-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies with folder-level isolation
-- Structure: technicians/<technician_id>/job-cards/<job_card_id>/filename.jpg
-- Or: job-cards/<job_card_id>/filename.jpg

-- Technicians can upload to their own folder or job-card folders
CREATE POLICY "Technicians can upload to assigned folders"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-card-images' 
    AND (
      -- Manager can upload anywhere
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR
      -- Technician can upload to their own folder
      (storage.foldername(name))[1] = 'technicians'
      AND (storage.foldername(name))[2] = public.get_current_technician_id()::text
      OR
      -- Technician can upload to job-cards folder for their assignments
      (storage.foldername(name))[1] = 'job-cards'
    )
  );

-- Technicians and managers can view all images
CREATE POLICY "Authenticated can view all job-card-images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'job-card-images');

-- Users can delete their own uploads or managers can delete any
CREATE POLICY "Users can delete own uploads, managers can delete all"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'job-card-images' 
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR owner_id = auth.uid()::text
    )
  );

-- ============================================================================
-- Phase 8: Enable Realtime (via SQL - also enable in Dashboard)
-- ============================================================================

-- Enable realtime for appointments table
ALTER TABLE public.appointments REPLICA IDENTITY FULL;

-- Enable realtime for technician_availability table
ALTER TABLE public.technician_availability REPLICA IDENTITY FULL;

-- Note: In Supabase Dashboard, go to Database > Replication > Realtime
-- and ensure these tables are enabled for realtime updates

-- ============================================================================
-- Phase 9: Seed Sample Data (Optional - for testing)
-- ============================================================================

-- Note: To create a test technician, run:
-- INSERT INTO public.technicians (company_id, user_id, name, email, phone)
-- SELECT 
--   (SELECT id FROM public.companies LIMIT 1),
--   id, 
--   'Test Technician', 
--   email, 
--   '+1234567890'
-- FROM auth.users WHERE email = 'tech@example.com'
-- ON CONFLICT DO NOTHING;
