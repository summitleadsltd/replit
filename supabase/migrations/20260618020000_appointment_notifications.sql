-- Appointment Notifications Table
-- For tracking customer notifications sent for appointments

CREATE TABLE IF NOT EXISTS public.appointment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  message TEXT NOT NULL,
  method TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated can view notifications" ON public.appointment_notifications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert notifications" ON public.appointment_notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX idx_notifications_appointment ON public.appointment_notifications(appointment_id);
CREATE INDEX idx_notifications_contact ON public.appointment_notifications(contact_id);
CREATE INDEX idx_notifications_type ON public.appointment_notifications(notification_type);
CREATE INDEX idx_notifications_sent_at ON public.appointment_notifications(sent_at);
