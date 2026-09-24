import { useQuery } from '@tanstack/react-query';

import { CARD_FUND_DESTINATION_TYPE } from '@/components/Card/CardFund/constants';
import { usesDirectDepositAddress } from '@/components/DepositOption/WalletDepositAddress/constants';
import useUser from '@/hooks/useUser';
import { createDirectDepositSession } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

export const WALLET_DEPOSIT_ADDRESS_QUERY_KEY = 'wallet-deposit-address';

/**
 * The address to show for a (chain, currency) pairing on the deposit screen.
 *
 * Two answers, because the pipeline only has a route for one of them:
 *
 * - Stablecoins get an address minted by `createDirectDepositSession`. That
 *   address is watched, so a transfer to it is detected, credited and recorded
 *   as activity.
 * - ETH, WETH, FUSE and WFUSE get the Safe. Nothing mints an address for them
 *   and nothing would watch it; they are sent to the Safe and sit there as the
 *   token that was sent, which is what the screen should say.
 *
 * The destination is the card's (`RAIN_CARD`), which is not the misnomer it
 * looks like: the name is historical and the backend resolves the issuer, so it
 * delivers to a Rain card or to the cardholder's Safe accordingly. Everyone who
 * reaches this screen — a Wirex cardholder, or someone with no card at all — is
 * on the Safe side of that. Rain cardholders are routed to "Fund your card"
 * instead and never see it.
 *
 * Minting a session is a POST, so a failure is not retried into a loop; the
 * caller shows the failure rather than quietly falling back to the Safe, which
 * would hand out an address the deposit would be stranded on.
 */
export const useWalletDepositAddress = (chainId: number, symbol: string) => {
  const { user } = useUser();
  const needsSession = usesDirectDepositAddress(symbol);

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
