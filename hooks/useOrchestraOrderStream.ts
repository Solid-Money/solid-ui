import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { ORCHESTRA_STATUS_KEY, useOrchestraOrderStatus } from '@/hooks/useOrchestra';
import { orchestraStreamUrl } from '@/lib/api/orchestra';
import { OrchestraError } from '@/lib/orchestraErrors';
import { ORCHESTRA_SETTLED_STATUSES } from '@/lib/types/orchestra';

import type { OrchestraStatus } from '@/lib/types/orchestra';

/**
 * Live status for one Orchestra order: our backend's SSE proxy where it can be
 * reached, the documented 3-second poll everywhere else.
 *
 * `EventSource` is a browser API — React Native ships none and the app carries
 * no polyfill — so native builds poll, which the docs name as the supported
 * fallback rather than a degraded mode. It also cannot set headers, which is
 * why the stream is cookie-authenticated: that is how web sessions authenticate
 * here anyway, and native never opens one.
 *
 * The poll keeps running underneath at a slow backstop while the stream is
 * healthy. Frames carry only the status, and a reconnect does not replay missed
 * transitions, so the snapshot stays the thing that reconciles.
 */
export function useOrchestraOrderStream(orderId: string | undefined) {
  const queryClient = useQueryClient();
  const [streamedStatus, setStreamedStatus] = useState<OrchestraStatus>();
  const [isStreaming, setIsStreaming] = useState(false);

  const { data, error } = useOrchestraOrderStatus(orderId, { poll: !isStreaming });

  // The snapshot wins when it has one. The stream is faster off the mark, but
  // the poll it triggers is what carries the amounts beside the status, and two
  // sources disagreeing on screen is worse than a beat of lag.
  const status = data?.order?.status ?? streamedStatus;
  const isSettled = status ? ORCHESTRA_SETTLED_STATUSES.includes(status) : false;

  // A 4xx on the snapshot — a lapsed session, an order that is not ours — is
  // not a hiccup the stream can route around: the same credentials open it.
  const isUnreadable = error instanceof OrchestraError && error.status >= 400 && error.status < 500;

  useEffect(() => {
    if (!orderId || isSettled || isUnreadable) return;
    if (typeof EventSource === 'undefined') return;

    const source = new EventSource(orchestraStreamUrl(orderId), { withCredentials: true });

    const onStatus = (event: MessageEvent) => {
      setIsStreaming(true);
      let next: OrchestraStatus | undefined;
      try {
        next = (JSON.parse(event.data) as { status?: OrchestraStatus }).status;
      } catch {
        // A frame we can't read is no reason to drop the stream — the snapshot
        // is still being read underneath and will catch the same transition.
        return;
      }
      if (!next) return;
      setStreamedStatus(next);
      // The frame carries the state and nothing else, so pull the snapshot that
      // goes with it: amounts and errorCode should land with the change.
      void queryClient.invalidateQueries({ queryKey: [ORCHESTRA_STATUS_KEY, orderId] });
    };

    // EventSource reconnects on its own, so an error means "not connected right
    // now", not "give up". Dropping the flag hands the screen back to the fast
    // poll until a frame proves otherwise.
    const onError = () => setIsStreaming(false);

    source.addEventListener('status', onStatus as EventListener);
    source.addEventListener('error', onError);

    return () => {
      source.removeEventListener('status', onStatus as EventListener);
      source.removeEventListener('error', onError);
      source.close();
      setIsStreaming(false);
    };
  }, [orderId, isSettled, isUnreadable, queryClient]);

  return {
    status,
    order: data?.order ?? null,
    stages: data?.stages ?? [],
    /** True once a frame has arrived; always false on native. */
    isStreaming,
    /** Only set when the *snapshot* read failed — a dead stream is not an error. */
    error,
    /** The order can no longer be read at all; nothing further will arrive. */
    isUnreadable,
  };
}

export default useOrchestraOrderStream;
