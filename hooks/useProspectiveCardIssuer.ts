import { useQuery } from '@tanstack/react-query';

import { resolveProspectiveCardIssuer } from '@/lib/kycProviderRouting';
import { CardProvider } from '@/lib/types';
import { useUserStore } from '@/store/useUserStore';

export const PROSPECTIVE_CARD_ISSUER_QUERY_KEY = 'prospectiveCardIssuer';

/**
 * Which issuer would serve this user's card application, for the window before
 * `/cards/status` can say — it 404s until a card customer exists, and that is
 * precisely when the activation screen has to decide whether to show the
 * minimum-deposit steps.
 *
 * Keyed by user: the backend answers per account (from the JWT), so two people
 * on one device can get different issuers and the answer must never be shared
 * between them.
 *
 * Pass `enabled: false` once the backend has an answer of its own — this exists
 * only to fill that gap, and re-asking afterwards would be a request per poll of
 * a screen that already knows.
 */
export function useProspectiveCardIssuer({ enabled = true }: { enabled?: boolean } = {}): {
  issuer: CardProvider | null;
  isLoading: boolean;
} {
  const selectedUserId = useUserStore(state => state.users.find(user => user.selected)?.userId);

  const { data, isLoading } = useQuery({
    queryKey: [PROSPECTIVE_CARD_ISSUER_QUERY_KEY, selectedUserId],
    queryFn: resolveProspectiveCardIssuer,
    enabled: enabled && Boolean(selectedUserId),
    // The routing answer is a jurisdiction decision, not live state; it changes
    // when the user's declared country does, which re-enters this screen anyway.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return { issuer: data ?? null, isLoading: enabled && isLoading };
}
