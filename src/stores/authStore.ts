import { create } from 'zustand';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { User, UserRole } from '@/types/database';

interface AuthState {
  session: Session | null;
  supabaseUser: SupabaseUser | null;
  profile: User | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  supabaseUser: null,
  profile: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ session, supabaseUser: session.user });
        await get().fetchProfile(session.user.id);
      }
      set({ initialized: true });

      supabase.auth.onAuthStateChange(async (_event, session) => {
        set({ session, supabaseUser: session?.user ?? null });
        if (session?.user) {
          await get().fetchProfile(session.user.id);
        } else {
          set({ profile: null });
        }
      });
    } catch {
      set({ initialized: true });
    }
  },

  fetchProfile: async (userId: string) => {
    const { data } = await supabase
      .from('ss_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      set({ profile: data as User });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, supabaseUser: null, profile: null });
  },
}));

export function useRole(): UserRole | null {
  return useAuthStore((s) => s.profile?.role ?? null);
}

export function useIsManager(): boolean {
  return useAuthStore((s) => s.profile?.role === 'manager');
}

export function useIsScheduler(): boolean {
  return useAuthStore((s) => s.profile?.role === 'scheduler');
}

export function useIsTechnician(): boolean {
  return useAuthStore((s) => s.profile?.role === 'technician');
}
