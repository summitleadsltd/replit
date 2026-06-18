-- Technician Capacity Management
-- Phase 2: Dispatch Intelligence Engine
-- Adds capacity constraints to technicians for better scheduling

-- Add capacity fields to technicians table
ALTER TABLE public.technicians
ADD COLUMN IF NOT EXISTS max_jobs_per_day INT DEFAULT 8,
ADD COLUMN IF NOT EXISTS max_drive_time_minutes INT DEFAULT 180,
ADD COLUMN IF NOT EXISTS max_distance_miles INT DEFAULT 120,
ADD COLUMN IF NOT EXISTS current_job_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_drive_time_minutes INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_distance_miles INT DEFAULT 0;

-- Add comments to document the new fields
COMMENT ON COLUMN public.technicians.max_jobs_per_day IS 'Maximum number of jobs a technician can handle in a single day';
COMMENT ON COLUMN public.technicians.max_drive_time_minutes IS 'Maximum total drive time in minutes per day';
COMMENT ON COLUMN public.technicians.max_distance_miles IS 'Maximum total driving distance in miles per day';
COMMENT ON COLUMN public.technicians.current_job_count IS 'Current number of jobs scheduled for today';
COMMENT ON COLUMN public.technicians.current_drive_time_minutes IS 'Current total drive time in minutes for today';
COMMENT ON COLUMN public.technicians.current_distance_miles IS 'Current total driving distance in miles for today';

-- Create function to check technician capacity
CREATE OR REPLACE FUNCTION public.check_technician_capacity(
  p_technician_id UUID,
  p_appointment_date DATE
)
RETURNS TABLE (
  has_capacity BOOLEAN,
  job_count INT,
  drive_time INT,
  distance INT,
  max_jobs INT,
  max_drive_time INT,
  max_distance INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_jobs INT;
  v_max_drive_time INT;
  v_max_distance INT;
  v_job_count INT;
  v_drive_time INT;
  v_distance INT;
BEGIN
  -- Get technician capacity limits
  SELECT 
    max_jobs_per_day,
    max_drive_time_minutes,
    max_distance_miles
  INTO v_max_jobs, v_max_drive_time, v_max_distance
  FROM public.technicians
  WHERE id = p_technician_id;

  -- Get current day's job count
  SELECT COUNT(*)
  INTO v_job_count
  FROM public.technician_appointments
  WHERE technician_id = p_technician_id
    AND DATE(start_time) = p_appointment_date
    AND status NOT IN ('cancelled', 'no_show');

  -- Get current drive time and distance (would need travel data)
  -- For now, set to 0 - this would be calculated from route optimization
  v_drive_time := 0;
  v_distance := 0;

  RETURN QUERY SELECT
    v_job_count < v_max_jobs 
    AND v_drive_time < v_max_drive_time 
    AND v_distance < v_max_distance as has_capacity,
    v_job_count,
    v_drive_time,
    v_distance,
    v_max_jobs,
    v_max_drive_time,
    v_max_distance;
END;
$$;

-- Create function to update technician daily capacity
CREATE OR REPLACE FUNCTION public.update_technician_daily_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update technician capacity when appointments are added/removed
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.technicians
    SET 
      current_job_count = (
        SELECT COUNT(*)
        FROM public.technician_appointments
        WHERE technician_id = NEW.technician_id
          AND DATE(start_time) = DATE(NEW.start_time)
          AND status NOT IN ('cancelled', 'no_show')
      )
    WHERE id = NEW.technician_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.technicians
    SET 
      current_job_count = (
        SELECT COUNT(*)
        FROM public.technician_appointments
        WHERE technician_id = OLD.technician_id
          AND DATE(start_time) = DATE(OLD.start_time)
          AND status NOT IN ('cancelled', 'no_show')
      )
    WHERE id = OLD.technician_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for capacity updates
DROP TRIGGER IF EXISTS on_technician_appointment_capacity_update ON public.technician_appointments;
CREATE TRIGGER on_technician_appointment_capacity_update
  AFTER INSERT OR UPDATE OR DELETE ON public.technician_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_technician_daily_capacity();
