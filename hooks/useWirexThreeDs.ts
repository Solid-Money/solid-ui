import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCardProvider } from '@/hooks/useCardProvider';
import { useWalletMessageSigner } from '@/hooks/useWalletMessageSigner';
import {
  approveWirexThreeDsRequest,
  declineWirexThreeDsRequest,
  getWirexThreeDsRequests,
} from '@/lib/api';
import { isWebAuthnUserCancelledError } from '@/lib/execute';
import { CardProvider, WirexThreeDsDecisionOutcome, WirexThreeDsRequest } from '@/lib/types';

export const WIREX_THREE_DS_QUERY_KEY = ['wirexThreeDsRequests'];

/** Placeholder the backend leaves in `messageTemplate` for the signing timestamp. */
const NONCE_PLACEHOLDER = '{nonce}';

/** The user dismissed the passkey prompt — a decision, not a failure to report. */
export const THREE_DS_CANCELLED = 'cancelled' as const;

export type ThreeDsDecisionResult = WirexThreeDsDecisionOutcome | typeof THREE_DS_CANCELLED;

/**
 * A merchant's 3D Secure challenges on a Wirex card, and the two answers the
 * cardholder can give them.
 *
 * Wirex holds the transaction until it is answered, so everything here is on a
 * clock. That shapes two choices:
 *
 *  - **Polling.** The push is the fast path, but Wirex times a webhook out after
 *    10 seconds and never retries it, so a missed delivery is gone. Screens that
 *    are sitting on this list pass `pollMs` and pick up a challenge the push
 *    never delivered.
 *  - **Approving costs a passkey, declining does not.** The backend verifies the
 *    signature against the card's own wallet before letting a payment through, so
 *    a stolen session cannot approve spending. Refusing a payment is the safe
 *    direction and is deliberately not gated on a biometric prompt that could
 *    fail when someone needs to stop a transaction they do not recognise.
 */
export function useWirexThreeDs(options?: { pollMs?: number }) {
  const queryClient = useQueryClient();
  const { provider } = useCardProvider();
  const { signMessage } = useWalletMessageSigner();

  const isWirex = provider === CardProvider.WIREX;

  const query = useQuery({
    queryKey: WIREX_THREE_DS_QUERY_KEY,
    queryFn: getWirexThreeDsRequests,
    enabled: isWirex,
    // A challenge outlives neither the merchant's patience nor a cache entry:
    // always go and ask.
    staleTime: 0,
    refetchInterval: options?.pollMs,
    retry: false,
  });

  const messageTemplate = query.data?.messageTemplate;

  const decision = useMutation({
    mutationFn: async ({
      transactionId,
      decision,
    }: {
      transactionId: string;
      decision: 'approve' | 'decline';
    }): Promise<ThreeDsDecisionResult> => {
      if (decision === 'decline') {
        const result = await declineWirexThreeDsRequest(transactionId);
        return result.outcome;
      }

      if (!messageTemplate) {
        throw new Error('Still loading — try again in a moment');
      }

      // Stamped immediately before signing, not when the list loaded: the
      // backend and Wirex both reject a nonce older than five minutes.
      const nonce = Math.floor(Date.now() / 1000);
      let signature: string;
      try {
        signature = await signMessage(messageTemplate.replace(NONCE_PLACEHOLDER, String(nonce)));
      } catch (error) {
        if (isWebAuthnUserCancelledError(error)) return THREE_DS_CANCELLED;
        throw error;
      }

      const result = await approveWirexThreeDsRequest(transactionId, { signature, nonce });
      return result.outcome;
    },
    // Whatever the outcome — approved, declined, or gone — the list has moved on.
    onSettled: () => queryClient.invalidateQueries({ queryKey: WIREX_THREE_DS_QUERY_KEY }),
    retry: false,
  });

  const { mutateAsync } = decision;

  const decide = useCallback(
    (transactionId: string, verdict: 'approve' | 'decline') =>
      mutateAsync({ transactionId, decision: verdict }),
    [mutateAsync],
  );

  return {
    requests: (query.data?.requests ?? []) as WirexThreeDsRequest[],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
    /** Whether this cardholder can have 3DS challenges at all. */
    isSupported: isWirex,
    decide,
  };
}

/**
 * Turn whatever a failed decision threw into something worth showing.
 *
 * `lib/api` throws the raw `Response`, so the server's message is behind a body
 * read; without unpacking it every failure reads as "something went wrong".
 */
export async function describeThreeDsError(error: unknown): Promise<string> {
  if (error instanceof Response) {
    try {
      const body = await error.json();
      const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
      if (typeof message === 'string' && message.trim()) return message;
    } catch {
      // Fall through — an unreadable body is no reason to say nothing.
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
