import { supabase } from '@/lib/supabase';
import type { Appointment, AppointmentStatus } from '@/types/database';

export async function getAppointments(filters?: {
  technician_id?: string;
  status?: AppointmentStatus;
  start_date?: string;
  end_date?: string;
}) {
  let query = supabase
    .from('ss_appointments')
    .select(`
      *,
      customer:ss_customers(*),
      technician:ss_users!ss_appointments_technician_id_fkey(*),
      address:ss_addresses(*)
    `)
    .order('start_time', { ascending: true });

  if (filters?.technician_id) {
    query = query.eq('technician_id', filters.technician_id);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.start_date) {
    query = query.gte('start_time', filters.start_date);
  }
  if (filters?.end_date) {
    query = query.lte('start_time', filters.end_date);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Appointment[];
}

export async function getAppointment(id: string) {
  const { data, error } = await supabase
    .from('ss_appointments')
    .select(`
      *,
      customer:ss_customers(*),
      technician:ss_users!ss_appointments_technician_id_fkey(*),
      address:ss_addresses(*)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Appointment;
}

export async function createAppointment(appointment: {
  customer_id: string;
  technician_id: string;
  address_id: string;
  start_time: string;
  end_time: string;
  appointment_type: string;
  notes?: string;
  created_by: string;
}) {
  const { data, error } = await supabase
    .from('ss_appointments')
    .insert({ ...appointment, status: 'scheduled' })
    .select(`
      *,
      customer:ss_customers(*),
      technician:ss_users!ss_appointments_technician_id_fkey(*),
      address:ss_addresses(*)
    `)
    .single();
  if (error) throw error;
  return data as Appointment;
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const { data, error } = await supabase
    .from('ss_appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Appointment;
}

export async function rescheduleAppointment(id: string, start_time: string, end_time: string, technician_id?: string) {
  const update: Record<string, string> = {
    start_time,
    end_time,
    updated_at: new Date().toISOString(),
  };
  if (technician_id) update.technician_id = technician_id;

  const { data, error } = await supabase
    .from('ss_appointments')
    .update(update)
    .eq('id', id)
    .select(`
      *,
      customer:ss_customers(*),
      technician:ss_users!ss_appointments_technician_id_fkey(*),
      address:ss_addresses(*)
    `)
    .single();
  if (error) throw error;
  return data as Appointment;
}

export async function getTodayAppointments(technicianId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getAppointments({
    technician_id: technicianId,
    start_date: today.toISOString(),
    end_date: tomorrow.toISOString(),
  });
}

export async function getWeekAppointments(technicianId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return getAppointments({
    technician_id: technicianId,
    start_date: today.toISOString(),
    end_date: weekEnd.toISOString(),
  });
}
