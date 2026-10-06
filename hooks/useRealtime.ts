import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { realtimeClient } from '@/lib/realtime/realtimeClient';
import { selectIsRealtimeLive, useRealtimeStore } from '@/store/useRealtimeStore';

/**
 * Keep the app's realtime socket open for the signed-in session.
 *
 * Mount once, where the session lives (the protected layout). The socket
 * itself is a singleton that follows the selected account and the app's
 * foreground/background state on its own; this only starts it with a session
 * and stops it without one. See `lib/realtime/realtimeClient`.
 */
export function useRealtime(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    realtimeClient.start(queryClient);
    return () => realtimeClient.stop();
  }, [enabled, queryClient]);
}

/** Whether live updates are flowing — for slowing a poll the socket makes redundant. */
export const useIsRealtimeLive = (): boolean => useRealtimeStore(selectIsRealtimeLive);
