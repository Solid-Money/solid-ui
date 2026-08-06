import { useQuery } from '@tanstack/react-query';

import { getLandingPageApy } from '@/lib/api';

/**
 * Admin-managed APY shown on the onboarding landing page. Falls back to a
 * sensible default while loading so the copy never renders a blank/0 value.
 */
export const useLandingPageApy = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['landing-page-apy'],
    queryFn: getLandingPageApy,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    apy: data?.apy ?? 0,
    overrideEnabled: data?.overrideEnabled ?? false,
    mode: data?.mode,
    apys: data?.apys,
    isLoading,
    error,
  };
};
