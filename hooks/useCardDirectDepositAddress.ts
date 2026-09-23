import { useQuery } from '@tanstack/react-query';

import { CARD_FUND_DESTINATION_TYPE } from '@/components/Card/CardFund/constants';
import { createDirectDepositSession } from '@/lib/api';
import { EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID } from '@/lib/config';
import { withRefreshToken } from '@/lib/utils';

/** The card is funded in USDC on its funding chain; nothing else has a route in. */
const CARD_DEPOSIT_TOKEN = 'USDC';

export const CARD_DIRECT_DEPOSIT_ADDRESS_QUERY_KEY = 'card-direct-deposit-address';

/**
 * The address an external wallet should send to in order to fund the card.
 *
 * Deliberately the direct-deposit address rather than the card's own funding
 * contract. The contract does take a transfer, but nothing watches it: the
 * deposit pipeline resolves incoming transfers against the addresses it mints
 * here, so a transfer sent anywhere else is credited late, by hand, and shows
 * the user no activity and no confirmation in the meantime.
 *
 * `POST`s a session, so it is deliberately not retried on failure — the screen
 * shows a spinner and then nothing rather than minting sessions in a loop. It
 * stays fresh for the life of the screen; the address is stable per user, chain
 * and token, so re-requesting it buys nothing.
 */
export const useCardDirectDepositAddress = (enabled = true) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: [CARD_DIRECT_DEPOSIT_ADDRESS_QUERY_KEY, EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID],
    queryFn: () =>
      withRefreshToken(() =>
        createDirectDepositSession(
          EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID,
          CARD_DEPOSIT_TOKEN,
          CARD_FUND_DESTINATION_TYPE,
        ),
      ),
    enabled,
    staleTime: Infinity,
    retry: false,
  });

  return {
    address: data?.walletAddress,
    isLoading: enabled && isLoading,
    isError,
  };
};
