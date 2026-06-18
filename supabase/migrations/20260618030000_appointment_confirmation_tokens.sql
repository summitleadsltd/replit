-- Add confirmation token field to appointments table
-- This allows customers to access their appointments via a secure link

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS confirmation_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS confirmation_token_expires_at TIMESTAMPTZ;

-- Create index on confirmation token for fast lookups
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_token 
ON public.appointments(confirmation_token) 
WHERE confirmation_token IS NOT NULL;

-- Function to generate confirmation token using md5
CREATE OR REPLACE FUNCTION public.generate_confirmation_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT md5(random()::text || clock_timestamp()::text);
$$;

-- Function to set confirmation token for new appointments
CREATE OR REPLACE FUNCTION public.set_appointment_confirmation_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.confirmation_token IS NULL THEN
    NEW.confirmation_token := public.generate_confirmation_token();
    NEW.confirmation_token_expires_at := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate tokens
DROP TRIGGER IF EXISTS on_appointment_insert_set_token ON public.appointments;
CREATE TRIGGER on_appointment_insert_set_token
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_appointment_confirmation_token();

-- Function to refresh confirmation token
CREATE OR REPLACE FUNCTION public.refresh_confirmation_token(p_appointment_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token TEXT;
BEGIN
  v_new_token := public.generate_confirmation_token();
  
  UPDATE public.appointments
  SET 
    confirmation_token = v_new_token,
    confirmation_token_expires_at = now() + interval '7 days'
  WHERE id = p_appointment_id;
  
  RETURN v_new_token;
END;
$$;
