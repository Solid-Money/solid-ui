import { useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { QueryClient, useQueryClient } from '@tanstack/react-query';

import { useSyncActivities, UseSyncActivitiesOptions } from '@/hooks/useSyncActivities';
import { refreshAccountQueries } from '@/lib/refreshAccountQueries';
import { refreshWalletActivity } from '@/lib/refreshWalletActivity';
import { useAccountRefreshStore } from '@/store/useAccountRefreshStore';
import { useActivityStore } from '@/store/useActivityStore';
import { useUserStore } from '@/store/useUserStore';

const refreshPromises = new WeakMap<QueryClient, Map<string, Promise<void>>>();
const SYNC_OPTIONS = { syncOnAppActive: false, syncOnMount: false };

/** One awaited refresh for Home, every Activity filter and the web refresh button. */
export function useActivityRefresh(options: UseSyncActivitiesOptions = SYNC_OPTIONS) {
  const user = useUserStore(state => state.users.find(account => account.selected));
  const userId = user?.userId;
  const safeAddress = user?.safeAddress;
  const queryClient = useQueryClient();
  const { sync, isSyncing, isStale: isSyncStale, canSync } = useSyncActivities(options);
  const isRefreshing = useAccountRefreshStore(state =>
    userId ? !!state.refreshingByUser[userId] : false,
  );
  const hasEvents = useActivityStore(state => !!(userId && state.events[userId]?.length));

  const refetchAll = useCallback(
    (force = true): Promise<void> => {
      if (!userId || !safeAddress) return Promise.resolve();
      let pending = refreshPromises.get(queryClient);
      if (!pending) {
        pending = new Map();
        refreshPromises.set(queryClient, pending);
      }
      const existing = pending.get(userId);
      if (existing) return existing;

      useAccountRefreshStore.setState(state => ({
        refreshingByUser: { ...state.refreshingByUser, [userId]: true },
      }));
      const promise = (async () => {
        const failures: unknown[] = [];
        try {
          const result = await sync(undefined, force);
          if (result?.errors) failures.push(new Error('Some transactions could not be synced'));
        } catch (error) {
          failures.push(error);
        }
        const isSelected = () =>
          useUserStore.getState().users.find(account => account.selected)?.userId === userId;
        if (!isSelected()) return;

        // Read AFTER sync, even when sync fails: the server may still have newer
        // webhook data. Await every source before releasing the native spinner.
        const results = await Promise.allSettled([
          refreshWalletActivity(userId, safeAddress, isSelected).then(page => {
            if (!isSelected()) return;
            useAccountRefreshStore.setState(state => ({
              latestPageByUser: { ...state.latestPageByUser, [userId]: page },
            }));
          }),
          refreshAccountQueries(queryClient, userId, safeAddress, true),
        ]);
        for (const result of results) {
          if (result.status === 'rejected') failures.push(result.reason);
        }
        if (failures.length && isSelected()) {
          console.error('Account refresh failed:', failures[0]);
          Toast.show({
            type: 'error',
            text1: "Couldn't refresh everything",
            text2: 'Some data may be out of date. Pull to try again.',
          });
        }
      })().finally(() => {
        pending.delete(userId);
        useAccountRefreshStore.setState(state => ({
          refreshingByUser: { ...state.refreshingByUser, [userId]: false },
        }));
      });
      pending.set(userId, promise);
      return promise;
    },
    [userId, safeAddress, queryClient, sync],
  );

  return {
    refetchAll,
    isRefreshing,
    isSyncing: isSyncing || isRefreshing,
    isSyncStale,
    canSync,
    isLoading: (isSyncing || isRefreshing) && !hasEvents,
  };
}
