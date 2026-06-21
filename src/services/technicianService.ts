import { supabase } from '@/lib/supabase';
import type { User, AvailabilityBlock } from '@/types/database';

export async function getTechnicians() {
  const { data, error } = await supabase
    .from('ss_users')
    .select('*')
    .eq('role', 'technician')
    .order('name');
  if (error) throw error;
  return data as User[];
}

export async function getActiveTechnicians() {
  const { data, error } = await supabase
    .from('ss_users')
    .select('*')
    .eq('role', 'technician')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data as User[];
}

export async function getTechnician(id: string) {
  const { data, error } = await supabase
    .from('ss_users')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as User;
}

export async function createTechnician(technician: {
  name: string;
  email: string;
  phone?: string;
}) {
  // Create auth user first, then profile
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: technician.email,
    password: 'TempPass123!', // Should be changed on first login
    email_confirm: true,
  });
  if (authError) throw authError;

  const { data, error } = await supabase
    .from('ss_users')
    .insert({
      id: authData.user.id,
      name: technician.name,
      email: technician.email,
      phone: technician.phone,
      role: 'technician',
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as User;
}

export async function updateTechnician(id: string, updates: Partial<User>) {
  const { data, error } = await supabase
    .from('ss_users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as User;
}

export async function getAvailabilityBlocks(technicianId: string, startDate?: string, endDate?: string) {
  let query = supabase
    .from('ss_availability_blocks')
    .select('*')
    .eq('technician_id', technicianId)
    .order('start_time');

  if (startDate) query = query.gte('start_time', startDate);
  if (endDate) query = query.lte('end_time', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data as AvailabilityBlock[];
}

export async function createAvailabilityBlock(block: {
  technician_id: string;
  start_time: string;
  end_time: string;
  reason: string;
}) {
  const { data, error } = await supabase
    .from('ss_availability_blocks')
    .insert(block)
    .select()
    .single();
  if (error) throw error;
  return data as AvailabilityBlock;
}

export async function deleteAvailabilityBlock(id: string) {
  const { error } = await supabase
    .from('ss_availability_blocks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
