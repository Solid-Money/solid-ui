import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getTransfiProhibitedCountries } from '@/lib/api';

const TRANSFI_PROHIBITED_COUNTRIES_QUERY = {
  queryKey: ['transfi-prohibited-countries'],
  queryFn: getTransfiProhibitedCountries,
  staleTime: 1000 * 60 * 5, // 5 minutes
  retry: 1,
};

/**
 * How long a confirmed-country check waits for the list before going on with
 * the last one read. A read paused while offline does not start until the
 * connection is back, so the request's own timeout cannot bound it.
 */
const CHECK_TIMEOUT_MS = 10_000;

const normalizeCountries = (codes: readonly string[] | undefined) =>
  (codes ?? [])
    .filter((code): code is string => typeof code === 'string')
    .map(code => code.trim().toUpperCase())
    .filter(Boolean);

/**
 * The countries the admin dashboard (Config → Countries) hides TransFi in, on
 * top of the list built into the app — so ops can close a market without a
 * release.
 *
 * Only ever adds restrictions: a failed or slow request leaves the build's list
 * in force, never "open everywhere". Retried once rather than the app's default
 * twice, because callers wait on it before showing TransFi at all.
 *
 * `isReading` covers the first read and any re-read of a list past
 * `staleTime`, including one paused until the device is back online, while
 * `countries` may still be the old list or none.
 */
export const useTransfiProhibitedCountries = () => {
  const queryClient = useQueryClient();
  const { data, fetchStatus } = useQuery(TRANSFI_PROHIBITED_COUNTRIES_QUERY);
  const isReading = fetchStatus !== 'idle';

  const countries = useMemo(() => normalizeCountries(data?.prohibitedCountries), [data]);

  /**
   * The list as it stands now, for a decision taken after an await, when the
   * render's `countries` may be out of date: a request still in flight is
   * waited for rather than read as empty, and a list older than `staleTime` is
   * read again. A read that fails keeps the last list read, if any; the build's
   * list applies on top either way.
   */
  const fetchCountries = useCallback(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const latest = await Promise.race([
        queryClient.fetchQuery(TRANSFI_PROHIBITED_COUNTRIES_QUERY),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Timed out reading the TransFi country list')),
            CHECK_TIMEOUT_MS,
          );
        }),
      ]);
      return normalizeCountries(latest.prohibitedCountries);
    } catch {
      const cached = queryClient.getQueryData<
        Awaited<ReturnType<typeof getTransfiProhibitedCountries>>
      >(TRANSFI_PROHIBITED_COUNTRIES_QUERY.queryKey);
      return normalizeCountries(cached?.prohibitedCountries);
    } finally {
      clearTimeout(timer);
    }
  }, [queryClient]);

  return { countries, isReading, fetchCountries };
};

export default useTransfiProhibitedCountries;
