import { useQuery } from '@tanstack/react-query';

import { getWalletOwnAddress } from '@/components/DepositOption/WalletDepositAddress/constants';
import { useCardProvider } from '@/hooks/useCardProvider';
import useUser from '@/hooks/useUser';
import { createDirectDepositSession } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

export const WALLET_DEPOSIT_ADDRESS_QUERY_KEY = 'wallet-deposit-address';

/**
 * Our own address for a (chain, currency) pairing on the deposit screen: only
 * for a row that is ours (`enabled`) — Fuse, USDT off Fuse, or Base for a
 * currency rhino.fi does not take. Every other row is rhino.fi's, and this
 * hands out nothing for it — not the Safe, and no minted address.
 *
 * Which of ours is `getWalletOwnAddress`'s to say:
 *
 * - A minted address (`createDirectDepositSession`), watched, so the transfer
 *   is detected, credited and recorded as activity: USDT on the chains the
 *   pipeline watches it on, as a `WALLET` session the backend delivers to the
 *   Safe on Base, and a Wirex cardholder's dollars on Fuse, as a `RAIN_CARD`
 *   session it delivers to their Safe on Fuse. That one is historical naming:
 *   the backend resolves the issuer, which is why it is Wirex's alone.
 * - The Safe, everywhere else it is offered, where the deposit lands as sent.
 *
 * Minting a session is a POST, so a failure is not retried into a loop; the
 * caller shows the failure rather than quietly falling back to the Safe, which
 * would hand out an address the deposit would be stranded on.
 */
export const useWalletDepositAddress = (
  chainId: number,
  symbol: string,
  { enabled = true }: { enabled?: boolean } = {},
) => {
  const { user } = useUser();
  const { provider } = useCardProvider();
  const own = enabled ? getWalletOwnAddress(chainId, symbol, provider) : undefined;
  const sessionDestination = own?.kind === 'session' ? own.destinationType : undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: [WALLET_DEPOSIT_ADDRESS_QUERY_KEY, chainId, symbol, sessionDestination],
    queryFn: () =>
      withRefreshToken(() =>
        createDirectDepositSession(chainId, symbol, sessionDestination ?? 'WALLET'),
      ),
    enabled: !!sessionDestination,
    staleTime: Infinity,
    retry: false,
  });

  if (!own) {
    return {
      address: undefined,
      isLoading: false,
      isError: false,
      isMinted: false,
      sessionDestination,
    };
  }

  if (!sessionDestination) {
    return {
      address: user?.safeAddress,
      isLoading: false,
      isError: false,
      isMinted: false,
      sessionDestination,
    };
  }

  return {
    address: data?.walletAddress,
    isLoading,
    isError,
    isMinted: true,
    sessionDestination,
  };
};
