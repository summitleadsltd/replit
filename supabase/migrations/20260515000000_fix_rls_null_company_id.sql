-- Fix RLS policies to handle NULL company_id properly
-- The is_same_company function was returning NULL when comparing NULL values,
-- causing 409 Conflict errors in RLS policy evaluation

-- Update is_same_company to handle NULL comparisons properly using IS NOT DISTINCT FROM
CREATE OR REPLACE FUNCTION public.is_same_company(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR _company_id IS NOT DISTINCT FROM public.current_company_id();
$$;

-- Update current_company_id to return NULL gracefully if no profile exists
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Ensure all profiles have a company_id set (use first company if NULL)
DO $$
DECLARE
  v_default_company_id uuid;
BEGIN
  -- Get the first company ID
  SELECT id INTO v_default_company_id FROM public.companies ORDER BY created_at LIMIT 1;
  
  -- If no companies exist, create one
  IF v_default_company_id IS NULL THEN
    INSERT INTO public.companies (name) VALUES ('Default Company')
    RETURNING id INTO v_default_company_id;
  END IF;
  
  -- Update any profiles with NULL company_id
  UPDATE public.profiles
  SET company_id = v_default_company_id
  WHERE company_id IS NULL;
END $$;
