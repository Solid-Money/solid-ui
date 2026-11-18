import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { createRhinoDepositAddress } from '@/lib/api';
import { showErrorToast } from '@/lib/errors';
import {
  getRhinoAddressErrorBody,
  isRhinoAddressForSelection,
  RhinoDepositSelection,
} from '@/lib/rhinoDeposit';
import { withRefreshToken } from '@/lib/utils';

export const RHINO_DEPOSIT_ADDRESS_QUERY_KEY = 'rhino-deposit-address';

const describeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  const status = (error as { status?: number } | null)?.status;
  return status ? `HTTP ${status}` : 'Unknown error';
};

/**
 * The user's rhino.fi deposit address for a selection, or nothing while
 * `selection` is undefined.
 *
 * A POST, but its answer does not change — one address per destination — so it
 * is cached for the session like `useWalletDepositAddress`, and a failure is
 * not retried into a loop. An address that is not for the selection (another
 * chain, token or destination) or is malformed for its chain (a 0x address for
 * Tron, say) counts as a failure: showing it would invite a transfer nothing
 * can receive.
 *
 * A failure is tracked, and toasted once with the reason when the backend gave
 * one (400: not offered, 412: no wallet yet, 503: rhino.fi unavailable). The
 * screen shows it too, with a retry (`refetch`): rhino.fi is the only provider
 * on the rows it serves, so there is no other address to show instead.
 */
export const useRhinoDepositAddress = (selection: RhinoDepositSelection | undefined) => {
  const { user } = useUser();
  const chain = selection?.chain;
  const tokenSymbol = selection?.tokenSymbol;
  const destinationType = selection?.destinationType;

  const query = useQuery({
    queryKey: [RHINO_DEPOSIT_ADDRESS_QUERY_KEY, user?.userId, chain, tokenSymbol, destinationType],
    queryFn: async () => {
      if (!selection || !chain || !tokenSymbol || !destinationType) {
        throw new Error('No rhino.fi selection');
      }
      const data = await withRefreshToken(() =>
        createRhinoDepositAddress({ chain, tokenSymbol, destinationType }),
      );
      if (!data?.depositAddress || !isRhinoAddressForSelection(data, selection)) {
        throw new Error(`Unexpected rhino.fi deposit address for ${chain}`);
      }
      return data;
    },
    enabled: !!selection,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    meta: { errorToast: false },
  });

  const { error, errorUpdatedAt } = query;
  // Once per failed request: `errorUpdatedAt` moves on with each new failure.
  const reportedAtRef = useRef(0);

  useEffect(() => {
    if (!error || !chain || !tokenSymbol || !destinationType) return;
    if (reportedAtRef.current === errorUpdatedAt) return;
    reportedAtRef.current = errorUpdatedAt;

    track(TRACKING_EVENTS.DEPOSIT_RHINO_ADDRESS_FAILED, {
      deposit_method: 'rhino_deposit_address',
      rhino_chain: chain,
      selected_token: tokenSymbol,
      destination_type: destinationType,
      error: describeError(error),
    });

    void showErrorToast(error, {
      action: 'deposit',
      title: 'Couldn’t get your deposit address',
      body: getRhinoAddressErrorBody(error),
      tags: {
        type: 'rhino_deposit_address_error',
        chain,
        token: tokenSymbol,
        destination: destinationType,
      },
    });
  }, [error, errorUpdatedAt, chain, tokenSymbol, destinationType]);

  return {
    address: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    /** A retry in flight, so the screen can trade its "Try again" for a spinner. */
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};
