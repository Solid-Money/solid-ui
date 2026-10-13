import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useHasFeature } from '@/hooks/useFeatureAccess';
import { isSupportChatConfigured } from '@/lib/api/support';
import { setSupportChatFocused } from '@/lib/support/focus';
import { loadThread, markRead, syncThread } from '@/lib/support/sync';
import { useSupportChatStore } from '@/store/useSupportChatStore';
import { useUserStore } from '@/store/useUserStore';

/**
 * Whether this user gets the in-house chat instead of Intercom: the
 * `supportChat` feature (a server-side whitelist, so it can open to staff
 * first) and a configured support API. Anything else keeps Intercom.
 */
export const useSupportChatEnabled = (): boolean => {
  const hasFeature = useHasFeature('supportChat');
  return hasFeature && isSupportChatConfigured();
};

/**
 * Keeps the shared thread current while something shows it: loads it once
 * (which is what puts the unread dot on the header button) and catches up
 * whenever the realtime socket reconnects.
 */
export const useSupportThreadSync = (enabled: boolean) => {
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const syncEpoch = useSupportChatStore(state => state.syncEpoch);
  const loaded = useSupportChatStore(state => state.loaded);

  useEffect(() => {
    if (!enabled || !userId || loaded) return;
    loadThread().catch(() => undefined); // The chat screen shows the failure; the badge just stays off.
  }, [enabled, userId, loaded]);

  const firstEpoch = useRef(syncEpoch);
  useEffect(() => {
    if (!enabled || !loaded || syncEpoch === firstEpoch.current) return;
    syncThread().catch(() => undefined);
  }, [enabled, loaded, syncEpoch]);
};

/** The unread replies count for the header badge (0 when the chat is off). */
export const useSupportUnread = (): number => {
  const enabled = useSupportChatEnabled();
  useSupportThreadSync(enabled);
  const unread = useSupportChatStore(state => state.unread);
  return enabled ? unread : 0;
};

type LoadState = 'loading' | 'ready' | 'error';

/**
 * The chat screen's lifecycle: load (or catch up on) the thread, mark it read
 * while it is on screen and the app is in front, and tell the push handler
 * not to banner replies the user is already looking at.
 */
export const useSupportChatScreen = () => {
  const loaded = useSupportChatStore(state => state.loaded);
  const messages = useSupportChatStore(state => state.messages);
  const unread = useSupportChatStore(state => state.unread);
  const [loadState, setLoadState] = useState<LoadState>(loaded ? 'ready' : 'loading');
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');

  useSupportThreadSync(true);

  const load = useCallback(() => {
    const held = useSupportChatStore.getState().loaded;
    // Anything already held stays on screen while it catches up.
    setLoadState(held ? 'ready' : 'loading');
    (held ? syncThread() : loadThread()).then(
      () => setLoadState('ready'),
      () => setLoadState(useSupportChatStore.getState().loaded ? 'ready' : 'error'),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      load();
      return () => {
        setFocused(false);
        // A context card the user left without sending must not ride along on a later visit.
        useSupportChatStore.getState().setDraftContext(null);
      };
    }, [load]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      const front = next !== 'background';
      setForeground(front);
      // Back from the background: the socket was closed there, so catch up.
      if (next === 'active' && useSupportChatStore.getState().loaded)
        syncThread().catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  // The web tab hidden counts as away: replies should still notify and stay unread.
  const [visible, setVisible] = useState(
    Platform.OS !== 'web' ||
      typeof document === 'undefined' ||
      document.visibilityState !== 'hidden',
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const looking = focused && foreground && visible;

  useEffect(() => {
    setSupportChatFocused(looking);
    return () => setSupportChatFocused(false);
  }, [looking]);

  useEffect(() => {
    if (looking && loaded && (unread > 0 || messages.length)) void markRead();
  }, [looking, loaded, unread, messages]);

  return { loadState, retry: load };
};
