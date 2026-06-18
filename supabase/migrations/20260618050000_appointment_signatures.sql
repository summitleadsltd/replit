-- Add digital signature capture to appointments
-- This allows customers to sign for completed appointments

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS customer_signature TEXT,
ADD COLUMN IF NOT EXISTS customer_signature_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_signature_ip_address TEXT;

-- Add comments to document the new fields
COMMENT ON COLUMN public.appointments.customer_signature IS 'Base64 encoded PNG image of customer signature';
COMMENT ON COLUMN public.appointments.customer_signature_signed_at IS 'Timestamp when customer signed';
COMMENT ON COLUMN public.appointments.customer_signature_ip_address IS 'IP address of device used for signing (for audit trail)';

-- Create index for signature queries
CREATE INDEX IF NOT EXISTS idx_appointments_signature ON public.appointments(customer_signature) WHERE customer_signature IS NOT NULL;
