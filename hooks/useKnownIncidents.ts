import { useQuery } from '@tanstack/react-query';

import { getKnownIncidents } from '@/lib/api/incidents';

export const KNOWN_INCIDENTS_QUERY_KEY = ['known-incidents'] as const;

/**
 * The known incidents for the Home notice. Checked every minute while the app
 * is open and again whenever it comes back to the foreground (the root layout
 * wires AppState into React Query's focus manager). A failed check just shows
 * nothing.
 */
export const useKnownIncidents = () =>
  useQuery({
    queryKey: KNOWN_INCIDENTS_QUERY_KEY,
    queryFn: ({ signal }) => getKnownIncidents(signal),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
