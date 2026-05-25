import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Type definitions for database tables (matches existing schema)
export type Technician = {
  id: string;
  company_id: string;
  user_id: string | null;
  name: string;
  home_address: string | null;
  phone: string | null;
  email: string | null;
  skills: string[];
  working_hours_start: string;
  working_hours_end: string;
  working_days: number[];
  is_active: boolean;
  created_at: string;
};

export type AppointmentStatus = 
  | 'booked' 
  | 'confirmed' 
  | 'rescheduled' 
  | 'completed' 
  | 'no_show' 
  | 'replaced'
  | 'on_route'
  | 'in_progress'
  | 'sale'
  | 'cancelled';

export type Appointment = {
  id: string;
  contact_id: string;
  technician_id: string | null;
  agent_id: string | null;
  campaign_id: string | null;
  appointment_at: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
};

export type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  phone_e164: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

export type JobCard = {
  id: string;
  appointment_id: string;
  technician_id: string;
  project_notes: string | null;
  installation_details: Record<string, any> | null;
  photos: string[];
  signature_url: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'sale' | 'cancelled';
  created_at: string;
};
