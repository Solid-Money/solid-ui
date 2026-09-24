import { useQuery } from '@tanstack/react-query';

import { CARD_FUND_DESTINATION_TYPE } from '@/components/Card/CardFund/constants';
import { usesDirectDepositAddress } from '@/components/DepositOption/WalletDepositAddress/constants';
import { useCardProvider } from '@/hooks/useCardProvider';
import useUser from '@/hooks/useUser';
import { createDirectDepositSession } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

export const WALLET_DEPOSIT_ADDRESS_QUERY_KEY = 'wallet-deposit-address';

/**
 * The address to show for a (chain, currency) pairing on the deposit screen.
 *
 * A Wirex cardholder depositing a stablecoin gets an address minted by
 * `createDirectDepositSession` — watched, so the transfer is detected, credited
 * and recorded as activity. Everyone else sees the Safe address, for every
 * currency (see {@link usesDirectDepositAddress}).
 *
 * The destination is the card's (`RAIN_CARD`), which is historical naming: the
 * backend resolves the issuer, and for Wirex that means their Safe on Fuse —
 * the balance their card settles from. Which is exactly why the rule is theirs
 * alone: the same call for a Rain cardholder would deliver to the card, and for
 * someone with no card there is no issuer to resolve.
 *
 * Minting a session is a POST, so a failure is not retried into a loop; the
 * caller shows the failure rather than quietly falling back to the Safe, which
 * would hand out an address the deposit would be stranded on.
 */
export const useWalletDepositAddress = (chainId: number, symbol: string) => {
  const { user } = useUser();
  const { provider } = useCardProvider();
  const needsSession = usesDirectDepositAddress(symbol, provider);

  const { data, isLoading, isError } = useQuery({
    queryKey: [WALLET_DEPOSIT_ADDRESS_QUERY_KEY, chainId, symbol],
    queryFn: () =>
      withRefreshToken(() =>
        createDirectDepositSession(chainId, symbol, CARD_FUND_DESTINATION_TYPE),
      ),
    enabled: needsSession,
    staleTime: Infinity,
    retry: false,
  });

  if (!needsSession) {
    return { address: user?.safeAddress, isLoading: false, isError: false, isMinted: false };
  }

  return {
    address: data?.walletAddress,
    isLoading,
    isError,
    isMinted: true,
  };
};
