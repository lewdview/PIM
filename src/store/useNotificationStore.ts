import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type AnnouncementCategory = 'drop' | 'event' | 'reward' | 'maintenance' | 'update' | 'general';
export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  action_url?: string | null;
  action_label?: string | null;
  reward_type?: 'tokens' | 'card' | 'none';
  reward_amount?: number;
  is_active: boolean;
  expires_at?: string | null;
  created_at: string;
}

interface NotificationState {
  announcements: SystemAnnouncement[];
  readIds: Set<string>;
  dismissedIds: Set<string>;
  bannerDismissedIds: Set<string>;
  unreadCount: number;
  isOpen: boolean;
  isLoading: boolean;
  activeBanner: SystemAnnouncement | null;
  
  // Actions
  setIsOpen: (isOpen: boolean) => void;
  fetchAnnouncements: (userId?: string | null) => Promise<void>;
  markAsRead: (id: string, userId?: string | null) => Promise<void>;
  markAllAsRead: (userId?: string | null) => Promise<void>;
  dismissAnnouncement: (id: string, userId?: string | null) => Promise<void>;
  dismissBanner: (id: string) => void;
  subscribeRealtime: (userId?: string | null) => () => void;
}

const LOCAL_READ_KEY = 'pim_notifications_read';
const LOCAL_DISMISSED_KEY = 'pim_notifications_dismissed';
const LOCAL_BANNER_DISMISSED_KEY = 'pim_banner_dismissed';

function getLocalSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveLocalSet(key: string, set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn(`[Notifications] Failed to persist ${key}:`, err);
  }
}

let realtimeSubscription: RealtimeChannel | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  announcements: [],
  readIds: getLocalSet(LOCAL_READ_KEY),
  dismissedIds: getLocalSet(LOCAL_DISMISSED_KEY),
  bannerDismissedIds: getLocalSet(LOCAL_BANNER_DISMISSED_KEY),
  unreadCount: 0,
  isOpen: false,
  isLoading: false,
  activeBanner: null,

  setIsOpen: (isOpen: boolean) => set({ isOpen }),

  fetchAnnouncements: async (userId?: string | null) => {
    set({ isLoading: true });
    try {
      // 1. Fetch active announcements from database
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('system_announcements')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Notifications] Error fetching announcements:', error.message);
        set({ isLoading: false });
        return;
      }

      const announcements: SystemAnnouncement[] = data || [];

      // 2. Fetch read/dismissed state
      let readSet = getLocalSet(LOCAL_READ_KEY);
      let dismissedSet = getLocalSet(LOCAL_DISMISSED_KEY);
      const bannerDismissedSet = getLocalSet(LOCAL_BANNER_DISMISSED_KEY);

      if (userId) {
        const { data: readData } = await supabase
          .from('user_notification_reads')
          .select('announcement_id, dismissed')
          .eq('user_id', userId);

        if (readData && readData.length > 0) {
          readData.forEach(r => {
            readSet.add(r.announcement_id);
            if (r.dismissed) dismissedSet.add(r.announcement_id);
          });
          saveLocalSet(LOCAL_READ_KEY, readSet);
          saveLocalSet(LOCAL_DISMISSED_KEY, dismissedSet);
        }
      }

      // Calculate unread count (active and not dismissed and not read)
      const visibleAnnouncements = announcements.filter(a => !dismissedSet.has(a.id));
      const unreadCount = visibleAnnouncements.filter(a => !readSet.has(a.id)).length;

      // Determine active banner (highest priority urgent/high announcement not dismissed)
      const activeBanner = visibleAnnouncements.find(
        a => (a.priority === 'urgent' || a.priority === 'high') && !bannerDismissedSet.has(a.id)
      ) || null;

      set({
        announcements: visibleAnnouncements,
        readIds: readSet,
        dismissedIds: dismissedSet,
        bannerDismissedIds: bannerDismissedSet,
        unreadCount,
        activeBanner,
        isLoading: false,
      });
    } catch (err) {
      console.warn('[Notifications] Exception fetching announcements:', err);
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string, userId?: string | null) => {
    const { readIds, announcements, dismissedIds } = get();
    if (readIds.has(id)) return;

    const newReadIds = new Set(readIds);
    newReadIds.add(id);
    saveLocalSet(LOCAL_READ_KEY, newReadIds);

    const visibleAnnouncements = announcements.filter(a => !dismissedIds.has(a.id));
    const unreadCount = visibleAnnouncements.filter(a => !newReadIds.has(a.id)).length;

    set({ readIds: newReadIds, unreadCount });

    if (userId) {
      try {
        await supabase
          .from('user_notification_reads')
          .upsert({
            user_id: userId,
            announcement_id: id,
            read_at: new Date().toISOString(),
            dismissed: false,
          }, { onConflict: 'user_id,announcement_id' });
      } catch (e) {
        console.warn('[Notifications] Failed to sync read status:', e);
      }
    }
  },

  markAllAsRead: async (userId?: string | null) => {
    const { announcements, readIds, dismissedIds } = get();
    const newReadIds = new Set(readIds);

    announcements.forEach(a => {
      if (!dismissedIds.has(a.id)) {
        newReadIds.add(a.id);
      }
    });

    saveLocalSet(LOCAL_READ_KEY, newReadIds);
    set({ readIds: newReadIds, unreadCount: 0 });

    if (userId) {
      try {
        const upserts = Array.from(newReadIds).map(id => ({
          user_id: userId,
          announcement_id: id,
          read_at: new Date().toISOString(),
          dismissed: dismissedIds.has(id),
        }));

        if (upserts.length > 0) {
          await supabase
            .from('user_notification_reads')
            .upsert(upserts, { onConflict: 'user_id,announcement_id' });
        }
      } catch (e) {
        console.warn('[Notifications] Failed to sync all read status:', e);
      }
    }
  },

  dismissAnnouncement: async (id: string, userId?: string | null) => {
    const { dismissedIds, readIds, announcements, activeBanner } = get();
    const newDismissedIds = new Set(dismissedIds);
    newDismissedIds.add(id);
    saveLocalSet(LOCAL_DISMISSED_KEY, newDismissedIds);

    const newReadIds = new Set(readIds);
    newReadIds.add(id);
    saveLocalSet(LOCAL_READ_KEY, newReadIds);

    const remainingAnnouncements = announcements.filter(a => !newDismissedIds.has(a.id));
    const unreadCount = remainingAnnouncements.filter(a => !newReadIds.has(a.id)).length;
    const newBanner = activeBanner?.id === id ? null : activeBanner;

    set({
      announcements: remainingAnnouncements,
      dismissedIds: newDismissedIds,
      readIds: newReadIds,
      unreadCount,
      activeBanner: newBanner,
    });

    if (userId) {
      try {
        await supabase
          .from('user_notification_reads')
          .upsert({
            user_id: userId,
            announcement_id: id,
            read_at: new Date().toISOString(),
            dismissed: true,
          }, { onConflict: 'user_id,announcement_id' });
      } catch (e) {
        console.warn('[Notifications] Failed to sync dismissal:', e);
      }
    }
  },

  dismissBanner: (id: string) => {
    const { bannerDismissedIds } = get();
    const newBannerSet = new Set(bannerDismissedIds);
    newBannerSet.add(id);
    saveLocalSet(LOCAL_BANNER_DISMISSED_KEY, newBannerSet);
    set({ bannerDismissedIds: newBannerSet, activeBanner: null });
  },

  subscribeRealtime: (userId?: string | null) => {
    if (realtimeSubscription) {
      supabase.removeChannel(realtimeSubscription);
      realtimeSubscription = null;
    }

    // Initial fetch
    get().fetchAnnouncements(userId);

    // Subscribe to system_announcements channel
    realtimeSubscription = supabase
      .channel('system_announcements_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_announcements' },
        () => {
          console.log('[Notifications] Received live announcement event. Refreshing inbox...');
          get().fetchAnnouncements(userId);
        }
      )
      .subscribe();

    return () => {
      if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription);
        realtimeSubscription = null;
      }
    };
  },
}));
