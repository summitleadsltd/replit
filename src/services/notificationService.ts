import { supabase } from '@/lib/supabase';

export async function createNotification(params: {
  user_id: string;
  title: string;
  body: string;
  type: string;
  reference_id?: string;
}) {
  const { error } = await supabase
    .from('ss_notifications')
    .insert({
      ...params,
      read: false,
    });
  if (error) throw error;
}

export async function notifyNewAppointment(
  technicianId: string,
  customerName: string,
  appointmentTime: string,
  appointmentId: string,
) {
  await createNotification({
    user_id: technicianId,
    title: 'New Appointment Assigned',
    body: `You have a new appointment with ${customerName} at ${appointmentTime}`,
    type: 'appointment_assigned',
    reference_id: appointmentId,
  });
}

export async function notifyAppointmentChanged(
  technicianId: string,
  customerName: string,
  appointmentId: string,
) {
  await createNotification({
    user_id: technicianId,
    title: 'Appointment Updated',
    body: `Your appointment with ${customerName} has been updated`,
    type: 'appointment_changed',
    reference_id: appointmentId,
  });
}

export async function notifyAppointmentCancelled(
  technicianId: string,
  customerName: string,
  appointmentId: string,
) {
  await createNotification({
    user_id: technicianId,
    title: 'Appointment Cancelled',
    body: `Your appointment with ${customerName} has been cancelled`,
    type: 'appointment_cancelled',
    reference_id: appointmentId,
  });
}
