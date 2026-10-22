import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getTransfiProhibitedCountries } from '@/lib/api';

const TRANSFI_PROHIBITED_COUNTRIES_QUERY = {
  queryKey: ['transfi-prohibited-countries'],
  queryFn: getTransfiProhibitedCountries,
  staleTime: 1000 * 60 * 5, // 5 minutes
  retry: 1,
};

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
 * `isFetching` covers the first read and any re-read of a list past
 * `staleTime`, while `countries` may still be the old one.
 */
export const useTransfiProhibitedCountries = () => {
  const queryClient = useQueryClient();
  const { data, isFetching } = useQuery(TRANSFI_PROHIBITED_COUNTRIES_QUERY);

  const countries = useMemo(() => normalizeCountries(data?.prohibitedCountries), [data]);

  /**
   * The list as it stands now, for a decision taken after an await, when the
   * render's `countries` may be out of date: a request still in flight is
   * waited for rather than read as empty, and a list older than `staleTime` is
   * read again. A read that fails keeps the last list read, if any; the build's
   * list applies on top either way.
   */
  const fetchCountries = useCallback(async () => {
    try {
      const latest = await queryClient.fetchQuery(TRANSFI_PROHIBITED_COUNTRIES_QUERY);
      return normalizeCountries(latest.prohibitedCountries);
    } catch {
      const cached = queryClient.getQueryData<
        Awaited<ReturnType<typeof getTransfiProhibitedCountries>>
      >(TRANSFI_PROHIBITED_COUNTRIES_QUERY.queryKey);
      return normalizeCountries(cached?.prohibitedCountries);
    }
  }, [queryClient]);

  return { countries, isFetching, fetchCountries };
};

export default useTransfiProhibitedCountries;
