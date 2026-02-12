import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import useUser from '@/hooks/useUser';
import { syncActivities } from '@/lib/api';
import mmkvStorage from '@/lib/mmvkStorage';
import { SyncActivitiesOptions, SyncActivitiesResponse } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

// Sync timing constants (in milliseconds)
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes - skip sync if app opened within this time
const SYNC_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours - show prominent loading after this
const SYNC_MIN_INTERVAL_MS = 30 * 1000; // 30 seconds - minimum time between syncs
const LOCK_TIMEOUT_MS = 30 * 1000; // 30 seconds - force release lock if held this long

// Store to track last sync time per user
interface SyncState {
  lastSyncByUser: Record<string, number>;
  setLastSync: (userId: string, timestamp: number) => void;
  getLastSync: (userId: string) => number | undefined;
  isWithinCooldown: (userId: string) => boolean;
  isStale: (userId: string) => boolean;
  canSync: (userId: string) => boolean;
  // Synchronous lock to prevent race conditions across 20+ components
  isSyncingLock: boolean;
  syncLockTimestamp: number | null;
  acquireSyncLock: () => boolean;
  releaseSyncLock: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      lastSyncByUser: {},

      setLastSync: (userId: string, timestamp: number) => {
        set(state => ({
          lastSyncByUser: {
            ...state.lastSyncByUser,
            [userId]: timestamp,
          },
        }));
      },

      getLastSync: (userId: string) => {
        return get().lastSyncByUser[userId];
      },

      isWithinCooldown: (userId: string) => {
        const lastSync = get().lastSyncByUser[userId];
        if (!lastSync) return false;
        return Date.now() - lastSync < SYNC_COOLDOWN_MS;
      },

      isStale: (userId: string) => {
        const lastSync = get().lastSyncByUser[userId];
        if (!lastSync) return true; // Never synced = stale
        return Date.now() - lastSync > SYNC_STALE_MS;
      },

      canSync: (userId: string) => {
        const lastSync = get().lastSyncByUser[userId];
        if (!lastSync) return true; // Never synced = can sync
        return Date.now() - lastSync >= SYNC_MIN_INTERVAL_MS;
      },

      // Synchronous lock to prevent multiple components from starting syncs simultaneously
      isSyncingLock: false,
      syncLockTimestamp: null as number | null,

      acquireSyncLock: () => {
        const state = get();
        // If lock is held but older than LOCK_TIMEOUT_MS, force release (safety mechanism)
        if (state.isSyncingLock && state.syncLockTimestamp) {
          const lockAge = Date.now() - state.syncLockTimestamp;
          if (lockAge > LOCK_TIMEOUT_MS) {
            set({ isSyncingLock: false, syncLockTimestamp: null });
          } else {
            return false;
          }
        } else if (state.isSyncingLock) {
          return false;
        }
        set({ isSyncingLock: true, syncLockTimestamp: Date.now() });
        return true;
      },

      releaseSyncLock: () => {
        set({ isSyncingLock: false, syncLockTimestamp: null });
      },
    }),
    {
      name: 'activity-sync-state',
      storage: createJSONStorage(() => mmkvStorage('activity-sync-state')),
      // Only persist lastSyncByUser, not the runtime lock state
      partialize: state => ({ lastSyncByUser: state.lastSyncByUser }),
    },
  ),
);

export interface UseSyncActivitiesOptions {
  /** Whether to sync when app becomes active */
  syncOnAppActive?: boolean;
  /** Whether to sync immediately on mount (first time users) */
  syncOnMount?: boolean;
}

export interface UseSyncActivitiesReturn {
  /** Trigger a sync manually (for pull-to-refresh). Pass force=true to bypass cooldown and min interval */
  sync: (
    options?: SyncActivitiesOptions,
    force?: boolean,
  ) => Promise<SyncActivitiesResponse | undefined>;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Last sync result */
  lastResult: SyncActivitiesResponse | null;
  /** Whether the data is stale (>24 hours since last sync) */
  isStale: boolean;
  /** Whether we're within the cooldown period */
  isWithinCooldown: boolean;
  /** Time since last sync in milliseconds */
  timeSinceLastSync: number | null;
  /** Whether user can trigger another sync (respects min interval) */
  canSync: boolean;
}

/**
 * Hook for syncing on-chain activities from Blockscout.
 *
 * Implements smart sync strategy:
 * - First app open ever: Full sync with loading indicator
 * - App opened within 5 min: Skip sync, use cached data
 * - App opened after 5+ min: Background sync
 * - App opened after 24+ hours: Full sync with prominent indicator
 * - Pull-to-refresh: Always sync (respects 30s min interval)
 */
export function useSyncActivities(options: UseSyncActivitiesOptions = {}): UseSyncActivitiesReturn {
  const { syncOnAppActive = true, syncOnMount = true } = options;
  const { user } = useUser();
  const queryClient = useQueryClient();
  const appState = useRef(AppState.currentState);
  const hasInitialSynced = useRef(false);

  const {
    setLastSync,
    getLastSync,
    isWithinCooldown,
    isStale,
    canSync,
    acquireSyncLock,
    releaseSyncLock,
    isSyncingLock,
  } = useSyncStore(
    useShallow(state => ({
      setLastSync: state.setLastSync,
      getLastSync: state.getLastSync,
      isWithinCooldown: state.isWithinCooldown,
      isStale: state.isStale,
      canSync: state.canSync,
      acquireSyncLock: state.acquireSyncLock,
      releaseSyncLock: state.releaseSyncLock,
      isSyncingLock: state.isSyncingLock,
    })),
  );

  const userId = user?.userId;

  // Mutation for syncing
  const syncMutation = useMutation({
    mutationKey: ['sync-activities', userId],
    mutationFn: async (syncOptions?: SyncActivitiesOptions) => {
      if (!userId) throw new Error('User not authenticated');
      return withRefreshToken(() => syncActivities(syncOptions));
    },
    // CRITICAL: Cancel and reset BEFORE sync starts!
    // If bulk refetch is already in progress when sync triggers,
    // we must CANCEL those requests first, then reset to page 1 only.
    // This prevents React Query from refetching all 5 cached pages.
    onMutate: async () => {
      // Cancel any in-flight activity-events requests to prevent bulk refetch from continuing
      await queryClient.cancelQueries({ queryKey: ['activity-events'] });
      // Reset to first page only - this prevents bulk refetch of all cached pages
      // See: https://tanstack.com/query/v4/docs/react/guides/infinite-queries#what-if-i-want-to-refetch-only-the-first-page
      if (userId) {
        queryClient.setQueryData(['activity-events', userId], (oldData: any) => {
          if (!oldData?.pages?.length) return oldData;
          return {
            pages: oldData.pages.slice(0, 1),
            pageParams: oldData.pageParams.slice(0, 1),
          };
        });
      }
    },
    onSuccess: () => {
      if (userId) {
        setLastSync(userId, Date.now());
      }
    },
    onError: error => {
      console.error('Failed to sync activities:', error);
    },
  });

  // Extract stable function reference from mutation object
  // CRITICAL: useMutation returns a new object on every render, but mutateAsync is stable
  // Using the whole object as a dependency would cause infinite re-renders (React error #185)
  const mutateAsync = syncMutation.mutateAsync;

  // Smart sync function that respects cooldowns
  // Uses synchronous lock to prevent race conditions across 20+ components
  const smartSync = useCallback(
    async (syncOptions?: SyncActivitiesOptions, force = false) => {
      if (!userId) return undefined;

      // Check if we can sync (respects min interval)
      if (!force && !canSync(userId)) {
        return undefined;
      }

      // Acquire synchronous lock to prevent multiple components from syncing
      // This is checked BEFORE the async mutation starts, unlike isPending
      if (!acquireSyncLock()) {
        return undefined;
      }

      try {
        return await mutateAsync(syncOptions);
      } finally {
        // Always release the lock, regardless of success or failure
        // This ensures no memory leaks even if mutation is cancelled/aborted
        releaseSyncLock();
      }
    },
    [userId, canSync, acquireSyncLock, releaseSyncLock, mutateAsync],
  );

  // Manual sync for pull-to-refresh (respects min interval throttle by default)
  const sync = useCallback(
    async (syncOptions?: SyncActivitiesOptions, force = false) => {
      return smartSync(syncOptions, force);
    },
    [smartSync],
  );

  // Initial sync on mount (for first-time users)
  useEffect(() => {
    if (!syncOnMount || !userId || hasInitialSynced.current) return;

    const lastSync = getLastSync(userId);
    const neverSynced = !lastSync;
    const stale = isStale(userId);

    // Sync immediately for new users or stale data
    if (neverSynced || stale) {
      hasInitialSynced.current = true;
      smartSync(undefined, true);
    } else if (!isWithinCooldown(userId)) {
      // Background sync if not within cooldown
      hasInitialSynced.current = true;
      smartSync();
    } else {
      hasInitialSynced.current = true;
    }
  }, [userId, syncOnMount, getLastSync, isStale, isWithinCooldown, smartSync]);

  // Sync when app becomes active
  useEffect(() => {
    if (!syncOnAppActive || !userId) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // App is becoming active from background/inactive
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (!isWithinCooldown(userId)) {
          smartSync();
        } else {
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [userId, syncOnAppActive, isWithinCooldown, smartSync]);

  // Calculate time since last sync
  const timeSinceLastSync = userId
    ? (() => {
        const lastSync = getLastSync(userId);
        return lastSync ? Date.now() - lastSync : null;
      })()
    : null;

  return {
    sync,
    // Include both mutation pending and synchronous lock for accurate state
    isSyncing: syncMutation.isPending || isSyncingLock,
    lastResult: syncMutation.data ?? null,
    isStale: userId ? isStale(userId) : true,
    isWithinCooldown: userId ? isWithinCooldown(userId) : false,
    timeSinceLastSync,
    canSync: userId ? canSync(userId) : false,
  };
}
