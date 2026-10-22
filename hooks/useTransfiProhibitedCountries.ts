import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getTransfiProhibitedCountries } from '@/lib/api';

const TRANSFI_PROHIBITED_COUNTRIES_QUERY = {
  queryKey: ['transfi-prohibited-countries'],
  queryFn: getTransfiProhibitedCountries,
  staleTime: 1000 * 60 * 5, // 5 minutes
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
 * in force, never "open everywhere". Retried once rather than the default three
 * times, because callers wait on it before showing TransFi at all.
 */
export const useTransfiProhibitedCountries = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ ...TRANSFI_PROHIBITED_COUNTRIES_QUERY, retry: 1 });

  const countries = useMemo(() => normalizeCountries(data?.prohibitedCountries), [data]);

  /**
   * The list as it stands now, for a decision taken after an await, when the
   * render's `countries` may be out of date: a request still in flight is
   * waited for rather than read as empty, and a failed one is asked once more.
   * A read that still fails leaves only the build's list, as everywhere else.
   */
  const fetchCountries = useCallback(async () => {
    try {
      const latest = await queryClient.ensureQueryData(TRANSFI_PROHIBITED_COUNTRIES_QUERY);
      return normalizeCountries(latest.prohibitedCountries);
    } catch {
      return [];
    }
  }, [queryClient]);

  return { countries, isLoading, fetchCountries };
};

export default useTransfiProhibitedCountries;
