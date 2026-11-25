import { useEffect, useRef } from 'react';

import type { CardStatusResponse } from '@/lib/types';
import type { UseQueryResult } from '@tanstack/react-query';

/** A failed card status read is tried again after this, doubling each time, up to the max. */
export const CARD_STATUS_RETRY_MS = 2_000;
export const CARD_STATUS_RETRY_MAX_MS = 30_000;

type CardStatusQuery = Pick<
  UseQueryResult<CardStatusResponse | null>,
  'data' | 'isEnabled' | 'isError' | 'errorUpdatedAt' | 'refetch'
>;

/**
 * Whether the card status is known well enough to act on a card link (a
 * card the Rain sunset closed goes to its own screen, not the card pane).
 *
 * Known once it has been read (`null` for no card included), or when there
 * is no query to wait for (no user). Not known while it loads, while it is
 * paused offline, or after a read failed with nothing cached.
 *
 * While a link `waiting` on it finds a failed read, it is read again, each
 * time a little later, because the query itself does not retry. The wait
 * only starts over once the status is known or the link is gone: a retry in
 * flight (no longer an error, not yet an answer) does not reset it.
 */
export function useCardStatusReadiness(query: CardStatusQuery, waiting: boolean): boolean {
  const { data, isEnabled, isError, errorUpdatedAt, refetch } = query;
  const known = data !== undefined || !isEnabled;

  const retries = useRef(0);
  useEffect(() => {
    if (!waiting || known) {
      retries.current = 0;
      return;
    }
    // Loading, retrying, or paused offline: its own answer comes.
    if (!isError) return;
    const delay = Math.min(CARD_STATUS_RETRY_MS * 2 ** retries.current, CARD_STATUS_RETRY_MAX_MS);
    const timer = setTimeout(() => {
      retries.current += 1;
      void refetch();
    }, delay);
    return () => clearTimeout(timer);
  }, [waiting, known, isError, errorUpdatedAt, refetch]);

  return known;
}
