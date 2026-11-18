import { useQuery } from '@tanstack/react-query';
import { Address, formatUnits } from 'viem';
import { fuse } from 'viem/chains';

import BridgePaymasterABI from '@/lib/abis/BridgePayamster';
import { ADDRESSES } from '@/lib/config';
import { UserCopyError } from '@/lib/errors/UserCopyError';
import { publicClient } from '@/lib/wagmi';

/**
 * The Fuse BridgePaymaster sponsors an action only from a minimum amount, set
 * per target (the soUSD Teller for withdrawals, the card deposit manager for
 * card top-ups, the Stargate OFT for USDC sends). Below it the paymaster
 * reverts, the bundler rejects the whole operation, and the user only ever saw
 * "Couldn't withdraw. Try again in a moment", however many times they tried.
 * Read on-chain so the app follows the contract when the minimum changes.
 */
export const readSponsoredMinimum = (target: Address): Promise<bigint> =>
  publicClient(fuse.id).readContract({
    address: ADDRESSES.fuse.bridgePaymasterAddress,
    abi: BridgePaymasterABI,
    functionName: 'minSponsoredAmount',
    args: [target],
  });

export const useSponsoredMinimum = (target: Address | undefined) =>
  useQuery({
    queryKey: ['sponsoredMinimum', target],
    queryFn: () => readSponsoredMinimum(target as Address),
    enabled: !!target,
    staleTime: 5 * 60 * 1000,
  });

/** "Minimum withdrawal is 0.1 soUSD", trimmed of trailing zeros. */
export const sponsoredMinimumCopy = (
  what: 'withdrawal' | 'deposit',
  minimum: bigint,
  symbol: string,
  decimals = 6,
) => `Minimum ${what} is ${formatUnits(minimum, decimals)} ${symbol}`;

/**
 * Throws the minimum as user copy before anything is signed, for any path
 * that reaches the paymaster without the form's check. A failed read lets the
 * operation go ahead: the paymaster still enforces the minimum itself.
 */
export const assertSponsoredMinimum = async (
  target: Address,
  amount: bigint,
  copy: { what: 'withdrawal' | 'deposit'; symbol: string; decimals?: number },
) => {
  const minimum = await readSponsoredMinimum(target).catch(() => 0n);
  if (amount < minimum) {
    throw new UserCopyError(sponsoredMinimumCopy(copy.what, minimum, copy.symbol, copy.decimals));
  }
};
