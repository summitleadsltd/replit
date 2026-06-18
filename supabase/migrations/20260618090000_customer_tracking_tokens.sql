-- Add tracking token field to appointments table
-- This allows customers to track technician location via secure link

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS tracking_token_expires_at TIMESTAMPTZ;

-- Create index on tracking token for fast lookups
CREATE INDEX IF NOT EXISTS idx_appointments_tracking_token 
ON public.appointments(tracking_token) 
WHERE tracking_token IS NOT NULL;

-- Function to generate tracking token
CREATE OR REPLACE FUNCTION public.generate_tracking_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT md5(random()::text || clock_timestamp()::text || 'tracking');
$$;

-- Function to set tracking token for new appointments
CREATE OR REPLACE FUNCTION public.set_appointment_tracking_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_token IS NULL AND NEW.status = 'confirmed' THEN
    NEW.tracking_token := public.generate_tracking_token();
    NEW.tracking_token_expires_at := NEW.appointment_at + interval '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate tokens when appointment is confirmed
DROP TRIGGER IF EXISTS on_appointment_update_set_tracking_token ON public.appointments;
CREATE TRIGGER on_appointment_update_set_tracking_token
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_appointment_tracking_token();

-- Function to refresh tracking token
CREATE OR REPLACE FUNCTION public.refresh_tracking_token(p_appointment_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token TEXT;
  v_appointment_at TIMESTAMPTZ;
BEGIN
  SELECT appointment_at
  INTO v_appointment_at
  FROM public.appointments
  WHERE id = p_appointment_id;
  
  v_new_token := public.generate_tracking_token();
  
  UPDATE public.appointments
  SET 
    tracking_token = v_new_token,
    tracking_token_expires_at = v_appointment_at + interval '24 hours'
  WHERE id = p_appointment_id;
  
  RETURN v_new_token;
END;
$$;
