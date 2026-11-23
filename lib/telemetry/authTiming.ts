import { perfNow, spanMs } from '@/lib/telemetry/perfClock';

/**
 * How long the last session refresh took. After a few hours away the access
 * token has always expired, so the first requests of a launch or a return to
 * the app wait on this before they can run: a slow refresh is a slow home.
 *
 * Kept free of imports from lib/utils (which records into it) so it can never
 * become part of an import cycle.
 */
type AuthRefresh = { startedAt: number; endedAt: number; ok: boolean };

let last: AuthRefresh | null = null;

export const noteAuthRefresh = (startedAt: number, ok: boolean): void => {
  last = { startedAt, endedAt: perfNow(), ok };
};

/** The last refresh that started at or after `since` (a {@link perfNow} time), if any. */
export const getAuthRefreshSince = (
  since: number,
): { ms: number | undefined; ok: boolean } | null =>
  last && last.startedAt >= since
    ? { ms: spanMs(last.startedAt, last.endedAt), ok: last.ok }
    : null;
