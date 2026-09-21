import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { ORCHESTRA_STATUS_KEY, useOrchestraOrderStatus } from '@/hooks/useOrchestra';
import { orchestraStreamUrl } from '@/lib/api/orchestra';
import { OrchestraError } from '@/lib/orchestraErrors';
import { ORCHESTRA_SETTLED_STATUSES } from '@/lib/types/orchestra';

import type { OrchestraStatus } from '@/lib/types/orchestra';

/**
 * Live status for one Orchestra order: the SSE stream where it exists, the
 * documented 3-second poll everywhere else.
 *
 * `EventSource` is a browser API. React Native doesn't ship one and the app
 * carries no polyfill, so native builds take the polling path — which the docs
 * name as the supported fallback, not a degraded mode. The poll runs on web too
 * while the stream is down, and drops to a slow backstop once the stream is up:
 * frames carry only `{"status":"..."}`, so the amounts, stages and `errorCode`
 * the screen renders still have to come from /status.
 *
 * The stream is opened directly against Orchestra with the client key rather
 * than through a backend proxy. The proxy the docs prescribe exists to keep a
 * *server* key off the client; this app has neither a server nor a server key,
 * and the order-bound read token is what scopes the stream to this one order.
 */
export function useOrchestraOrderStream(
  orderId: string | undefined,
  readToken: string | undefined,
) {
  const queryClient = useQueryClient();
  const [streamedStatus, setStreamedStatus] = useState<OrchestraStatus>();
  const [isStreaming, setIsStreaming] = useState(false);

  // A healthy stream demotes the poll to its backstop cadence rather than
  // silencing it: reconnects don't replay missed transitions, so the snapshot
  // stays the thing that reconciles.
  const { data, error } = useOrchestraOrderStatus(orderId, readToken, { poll: !isStreaming });

  // The snapshot wins when it has one. The stream is faster off the mark, but
  // the poll it triggers is what carries the amounts beside the status, and two
  // sources disagreeing on screen is worse than a beat of lag.
  const status = data?.order?.status ?? streamedStatus;
  const isSettled = status ? ORCHESTRA_SETTLED_STATUSES.includes(status) : false;

  // A 4xx on the snapshot — an expired read token, a revoked key — is not a
  // hiccup the stream can route around: the same credentials open it. Stop
  // reconnecting and let the screen say it can't track the order, rather than
  // leaving a socket retrying against a door that is shut.
  const isUnreadable = error instanceof OrchestraError && error.status >= 400 && error.status < 500;

  useEffect(() => {
    if (!orderId || !readToken || isSettled || isUnreadable) return;
    if (typeof EventSource === 'undefined') return;

    const source = new EventSource(orchestraStreamUrl(orderId, readToken));

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
      // goes with it: amounts and errorCode should land with the change, not a
      // backstop interval later.
      void queryClient.invalidateQueries({ queryKey: [ORCHESTRA_STATUS_KEY, orderId] });
    };

    // Heartbeats arrive every 15 seconds and carry no data. Their only job is
    // to prove the connection is alive, which is what re-marks it healthy after
    // EventSource silently reconnects.
    const onHeartbeat = () => setIsStreaming(true);

    // EventSource reconnects on its own, so an error means "not connected right
    // now", not "give up". Dropping the flag hands the screen back to the fast
    // poll until a frame proves otherwise.
    const onError = () => setIsStreaming(false);

    source.addEventListener('status', onStatus as EventListener);
    source.addEventListener('heartbeat', onHeartbeat);
    source.addEventListener('error', onError);

    return () => {
      source.removeEventListener('status', onStatus as EventListener);
      source.removeEventListener('heartbeat', onHeartbeat);
      source.removeEventListener('error', onError);
      source.close();
      setIsStreaming(false);
    };
  }, [orderId, readToken, isSettled, isUnreadable, queryClient]);

  return {
    status,
    order: data?.order ?? null,
    stages: data?.stages ?? [],
    /** True once a frame or heartbeat has arrived; always false on native. */
    isStreaming,
    /** Only set when the *snapshot* read failed — a dead stream is not an error. */
    error,
    /** The order can no longer be read at all; nothing further will arrive. */
    isUnreadable,
  };
}

export default useOrchestraOrderStream;
