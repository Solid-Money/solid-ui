import { useCallback } from 'react';

import { useSyncActivities } from '@/hooks/useSyncActivities';
import useUser from '@/hooks/useUser';

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

  const {
    sync: syncFromBackend,
    isSyncing,
    isStale: isSyncStale,
  } = useSyncActivities({
    syncOnAppActive: false, // Don't auto-sync, this is just for manual refresh
    syncOnMount: false,
  });

  const refetchAll = useCallback(
    (force = false) => {
      if (!user?.userId || isSyncing) return;

      syncFromBackend(undefined, force).catch((error: any) => {
        console.error('Background sync failed:', error);
      });
    },
    [user?.userId, isSyncing, syncFromBackend],
  );

  return {
    refetchAll,
    isSyncing,
    isSyncStale,
  };
}
