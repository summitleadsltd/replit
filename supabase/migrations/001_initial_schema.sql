-- Summit Scheduler Database Schema
-- All tables prefixed with ss_ to avoid conflicts with existing tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SS_USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ss_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('manager', 'scheduler', 'technician')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ss_users_role ON public.ss_users(role);
CREATE INDEX IF NOT EXISTS idx_ss_users_active ON public.ss_users(active);
CREATE INDEX IF NOT EXISTS idx_ss_users_email ON public.ss_users(email);

-- ============================================
-- SS_CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ss_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ss_customers_name ON public.ss_customers(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_ss_customers_email ON public.ss_customers(email);

-- ============================================
-- SS_ADDRESSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ss_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.ss_customers(id) ON DELETE CASCADE,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip_code TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ss_addresses_customer ON public.ss_addresses(customer_id);

-- ============================================
-- SS_APPOINTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ss_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.ss_customers(id),
  technician_id UUID NOT NULL REFERENCES public.ss_users(id),
  address_id UUID NOT NULL REFERENCES public.ss_addresses(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  appointment_type TEXT NOT NULL CHECK (appointment_type IN ('installation', 'repair', 'maintenance', 'inspection', 'consultation')),
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES public.ss_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ss_appointments_technician ON public.ss_appointments(technician_id);
CREATE INDEX IF NOT EXISTS idx_ss_appointments_customer ON public.ss_appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_ss_appointments_start ON public.ss_appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_ss_appointments_status ON public.ss_appointments(status);

-- ============================================
-- SS_AVAILABILITY_BLOCKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ss_availability_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technician_id UUID NOT NULL REFERENCES public.ss_users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL DEFAULT 'personal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ss_availability_technician ON public.ss_availability_blocks(technician_id);
CREATE INDEX IF NOT EXISTS idx_ss_availability_time ON public.ss_availability_blocks(start_time, end_time);

-- ============================================
-- SS_NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ss_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.ss_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  type TEXT NOT NULL DEFAULT 'general',
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ss_notifications_user ON public.ss_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_ss_notifications_read ON public.ss_notifications(user_id, read);

-- ============================================
-- SS_DEVICE_TOKENS TABLE (FCM)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ss_device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.ss_users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ss_device_tokens_user ON public.ss_device_tokens(user_id);

-- ============================================
-- SS_BUSINESS_SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ss_business_settings (
  id TEXT PRIMARY KEY DEFAULT '1',
  business_hours_start TEXT NOT NULL DEFAULT '08:00',
  business_hours_end TEXT NOT NULL DEFAULT '17:00',
  default_appointment_duration INTEGER NOT NULL DEFAULT 60,
  working_days INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ss_business_settings (id) VALUES ('1') ON CONFLICT DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.ss_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ss_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ss_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ss_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ss_availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ss_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ss_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ss_business_settings ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.ss_get_user_role(user_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.ss_users WHERE id = user_id;
$$;

-- SS_USERS policies
CREATE POLICY "ss_users_select_own" ON public.ss_users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "ss_users_select_manager" ON public.ss_users FOR SELECT USING (public.ss_get_user_role(auth.uid()) = 'manager');
CREATE POLICY "ss_users_select_scheduler" ON public.ss_users FOR SELECT USING (public.ss_get_user_role(auth.uid()) = 'scheduler' AND role = 'technician');
CREATE POLICY "ss_users_insert_manager" ON public.ss_users FOR INSERT WITH CHECK (public.ss_get_user_role(auth.uid()) = 'manager');
CREATE POLICY "ss_users_update_manager" ON public.ss_users FOR UPDATE USING (public.ss_get_user_role(auth.uid()) = 'manager');
CREATE POLICY "ss_users_update_own" ON public.ss_users FOR UPDATE USING (auth.uid() = id);

-- SS_CUSTOMERS policies
CREATE POLICY "ss_customers_select" ON public.ss_customers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ss_customers_insert" ON public.ss_customers FOR INSERT WITH CHECK (public.ss_get_user_role(auth.uid()) IN ('manager', 'scheduler'));
CREATE POLICY "ss_customers_update" ON public.ss_customers FOR UPDATE USING (public.ss_get_user_role(auth.uid()) IN ('manager', 'scheduler'));

-- SS_ADDRESSES policies
CREATE POLICY "ss_addresses_select" ON public.ss_addresses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ss_addresses_insert" ON public.ss_addresses FOR INSERT WITH CHECK (public.ss_get_user_role(auth.uid()) IN ('manager', 'scheduler'));

-- SS_APPOINTMENTS policies
CREATE POLICY "ss_appointments_select" ON public.ss_appointments FOR SELECT USING (technician_id = auth.uid() OR public.ss_get_user_role(auth.uid()) IN ('manager', 'scheduler'));
CREATE POLICY "ss_appointments_insert" ON public.ss_appointments FOR INSERT WITH CHECK (public.ss_get_user_role(auth.uid()) IN ('manager', 'scheduler'));
CREATE POLICY "ss_appointments_update_manager" ON public.ss_appointments FOR UPDATE USING (public.ss_get_user_role(auth.uid()) = 'manager');
CREATE POLICY "ss_appointments_update_scheduler" ON public.ss_appointments FOR UPDATE USING (public.ss_get_user_role(auth.uid()) = 'scheduler');
CREATE POLICY "ss_appointments_update_tech" ON public.ss_appointments FOR UPDATE USING (technician_id = auth.uid());

-- SS_AVAILABILITY_BLOCKS policies
CREATE POLICY "ss_blocks_select" ON public.ss_availability_blocks FOR SELECT USING (technician_id = auth.uid() OR public.ss_get_user_role(auth.uid()) IN ('manager', 'scheduler'));
CREATE POLICY "ss_blocks_insert" ON public.ss_availability_blocks FOR INSERT WITH CHECK (technician_id = auth.uid());
CREATE POLICY "ss_blocks_delete" ON public.ss_availability_blocks FOR DELETE USING (technician_id = auth.uid());
CREATE POLICY "ss_blocks_manager" ON public.ss_availability_blocks FOR ALL USING (public.ss_get_user_role(auth.uid()) = 'manager');

-- SS_NOTIFICATIONS policies
CREATE POLICY "ss_notifications_select" ON public.ss_notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ss_notifications_update" ON public.ss_notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ss_notifications_insert" ON public.ss_notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- SS_DEVICE_TOKENS policies
CREATE POLICY "ss_tokens_all" ON public.ss_device_tokens FOR ALL USING (user_id = auth.uid());

-- SS_BUSINESS_SETTINGS policies
CREATE POLICY "ss_settings_select" ON public.ss_business_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ss_settings_update" ON public.ss_business_settings FOR UPDATE USING (public.ss_get_user_role(auth.uid()) = 'manager');
CREATE POLICY "ss_settings_insert" ON public.ss_business_settings FOR INSERT WITH CHECK (public.ss_get_user_role(auth.uid()) = 'manager');

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION public.ss_handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ss_users_updated_at BEFORE UPDATE ON public.ss_users FOR EACH ROW EXECUTE FUNCTION public.ss_handle_updated_at();
CREATE TRIGGER ss_customers_updated_at BEFORE UPDATE ON public.ss_customers FOR EACH ROW EXECUTE FUNCTION public.ss_handle_updated_at();
CREATE TRIGGER ss_appointments_updated_at BEFORE UPDATE ON public.ss_appointments FOR EACH ROW EXECUTE FUNCTION public.ss_handle_updated_at();
CREATE TRIGGER ss_settings_updated_at BEFORE UPDATE ON public.ss_business_settings FOR EACH ROW EXECUTE FUNCTION public.ss_handle_updated_at();
