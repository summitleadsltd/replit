import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/database';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async (userId: string) => {
    set({ loading: true });
    const { data } = await supabase
      .from('ss_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    const notifications = (data ?? []) as Notification[];
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      loading: false,
    });
  },

  markAsRead: async (notificationId: string) => {
    await supabase
      .from('ss_notifications')
      .update({ read: true })
      .eq('id', notificationId);

    const notifications = get().notifications.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n,
    );
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  },

  markAllAsRead: async (userId: string) => {
    await supabase
      .from('ss_notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    const notifications = get().notifications.map((n) => ({ ...n, read: true }));
    set({ notifications, unreadCount: 0 });
  },
}));
