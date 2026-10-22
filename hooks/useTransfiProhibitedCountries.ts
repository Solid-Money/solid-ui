import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getTransfiProhibitedCountries } from '@/lib/api';

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
  const { data, isLoading } = useQuery({
    queryKey: ['transfi-prohibited-countries'],
    queryFn: getTransfiProhibitedCountries,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  const countries = useMemo(
    () =>
      (data?.prohibitedCountries ?? [])
        .filter((code): code is string => typeof code === 'string')
        .map(code => code.trim().toUpperCase())
        .filter(Boolean),
    [data],
  );

  return { countries, isLoading };
};

export default useTransfiProhibitedCountries;
