import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { cardTransactionsQueryKey } from '@/hooks/useCardTransactions';
import { useSyncActivities } from '@/hooks/useSyncActivities';
import useUser from '@/hooks/useUser';
import { useActivityStore } from '@/store/useActivityStore';

/**
 * Lightweight hook for activity refresh functionality.
 * Use this instead of useActivity() when you only need refresh capabilities
 * without the heavy activity data computations.
 *
 * This prevents excessive re-renders in components like ActivityScreen
 * that don't need the full activity data.
 */
export function useActivityRefresh() {
  const { user } = useUser();
  const queryClient = useQueryClient();

  // Memoize options to ensure stable reference
  // (useSyncActivities extracts primitives, but this is good defensive coding)
  const syncOptions = useMemo(
    () => ({
      syncOnAppActive: false, // Don't auto-sync, this is just for manual refresh
      syncOnMount: false,
    }),
    [],
  );

  const { sync: syncFromBackend, isSyncing, isStale: isSyncStale } = useSyncActivities(syncOptions);

  // Derive isLoading: true when syncing AND no cached events (first load).
  // Narrow selector avoids re-rendering on every event change.
  const hasEvents = useActivityStore(
    state => !!(user?.userId && state.events[user.userId]?.length),
  );
  const isLoading = isSyncing && !hasEvents;

  const refetchAll = useCallback(
    (force = false) => {
      if (!user?.userId || isSyncing) return;

      // Card history is a separate query from the wallet activity store, so
      // without this the refresh button on the Card tab appears to work and
      // refreshes nothing. It matters most for cards whose transactions settle
      // out-of-band (Wirex), where a pending purchase only turns into a
      // confirmed one on a refetch.
      queryClient.invalidateQueries({ queryKey: cardTransactionsQueryKey });

      syncFromBackend(undefined, force).catch((error: any) => {
        console.error('Background sync failed:', error);
      });
    },
    [user?.userId, isSyncing, syncFromBackend, queryClient],
  );

  return {
    refetchAll,
    isSyncing,
    isSyncStale,
    isLoading,
  };
}
