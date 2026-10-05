import { useQuery } from '@tanstack/react-query';
import { Address, erc20Abi, formatUnits } from 'viem';
import { fuse } from 'viem/chains';

import { SolidCashModuleV2_ABI } from '@/lib/abis/SolidCashModuleV2';
import { SolidTierLock_ABI } from '@/lib/abis/SolidTierLock';
import { TokenBalance, TokenType } from '@/lib/types';
import { publicClient } from '@/lib/wagmi';

export type CreditCustody = {
  collateral: TokenBalance[];
  debtUsd: number;
};

export type PortfolioCustody = CreditCustody & { lockedFuse: number };

/** Symbol and decimals never change for a token, so read them once per session. */
const tokenMetadata = new Map<string, { symbol: string; decimals: number }>();
export const clearCustodyTokenMetadata = () => tokenMetadata.clear();

/** Locked soFUSE in the tier lock, in FUSE. Still the user's, and still earning. */
export async function readLockedFuse(safe: Address, lockAddress: Address | null): Promise<number> {
  if (!lockAddress) return 0;
  const assets = await publicClient(fuse.id).readContract({
    address: lockAddress,
    abi: SolidTierLock_ABI,
    functionName: 'lockedAssetsOf',
    args: [safe],
  });
  return Number(formatUnits(assets, 18));
}

/** Collateral escrowed by the credit modules (current and retired) and the debt against it. */
export async function readCreditCustody(
  safe: Address,
  creditModules: readonly Address[],
): Promise<CreditCustody> {
  const client = publicClient(fuse.id);

  const credit = async (creditModule: Address) => {
    const module = { address: creditModule, abi: SolidCashModuleV2_ABI } as const;
    const [tokens, debt] = await client.multicall({
      allowFailure: false,
      contracts: [
        { ...module, functionName: 'allowedTokens' },
        { ...module, functionName: 'debtUsd', args: [safe] },
      ],
    });
    const amounts = tokens.length
      ? await client.multicall({
          allowFailure: false,
          contracts: tokens.map(address => ({
            ...module,
            functionName: 'collateralOf' as const,
            args: [safe, address] as const,
          })),
        })
      : [];
    const held = tokens
      .map((address, index) => ({ address, amount: amounts[index] }))
      .filter(({ amount }) => amount !== 0n);

    const missing = held.filter(({ address }) => !tokenMetadata.has(address.toLowerCase()));
    if (missing.length) {
      const metadata = await client.multicall({
        allowFailure: false,
        contracts: missing.flatMap(({ address }) => [
          { address, abi: erc20Abi, functionName: 'symbol' as const },
          { address, abi: erc20Abi, functionName: 'decimals' as const },
        ]),
      });
      missing.forEach(({ address }, index) =>
        tokenMetadata.set(address.toLowerCase(), {
          symbol: metadata[index * 2] as string,
          decimals: metadata[index * 2 + 1] as number,
        }),
      );
    }
    const prices = held.length
      ? await client.multicall({
          allowFailure: false,
          contracts: held.map(({ address }) => ({
            ...module,
            functionName: 'getPriceUsd' as const,
            args: [address] as const,
          })),
        })
      : [];

    return {
      collateral: held.map(({ address, amount }, index) => {
        const { symbol, decimals } = tokenMetadata.get(address.toLowerCase())!;
        const [usd, usable, inBand] = prices[index];
        return {
          chainId: fuse.id,
          contractAddress: address,
          contractTickerSymbol: symbol,
          contractName: symbol,
          contractDecimals: decimals,
          balance: amount.toString(),
          quoteRate: usable && inBand && usd > 0n ? Number(formatUnits(usd, 6)) : undefined,
          type: TokenType.ERC20,
        } satisfies TokenBalance;
      }),
      debtUsd: Number(formatUnits(debt, 6)),
    };
  };

  const states = await Promise.all(
    [...new Set(creditModules.map(address => address.toLowerCase() as Address))].map(credit),
  );
  return {
    collateral: states.flatMap(state => state.collateral),
    debtUsd: states.reduce((total, state) => total + state.debtUsd, 0),
  };
}

/** Both custody reads together. Either failing rejects; nothing is reported as zero. */
export async function readPortfolioCustody(
  safe: Address,
  lockAddress: Address | null,
  creditModules: readonly Address[],
): Promise<PortfolioCustody> {
  const [lockedFuse, credit] = await Promise.all([
    readLockedFuse(safe, lockAddress),
    readCreditCustody(safe, creditModules),
  ]);
  return { lockedFuse, ...credit };
}

/**
 * Custody polls every 30s, not every block: home stays mounted for long sessions, and a
 * repay, borrow or lock elsewhere in the app refreshes these through refreshAccountQueries.
 */
const CUSTODY_POLL_MS = 30_000;

/**
 * The two custody reads run independently. Credit (collateral and debt) never waits on the
 * tier-membership API: if that backend call fails, a borrower's debt must still be read.
 * `lockAddress` is `undefined` until membership has loaded (unknown), `null` for no lock.
 */
export const usePortfolioCustody = ({
  userId,
  safeAddress,
  lockAddress,
  creditModules,
}: {
  userId?: string;
  safeAddress?: Address;
  lockAddress: Address | null | undefined;
  creditModules: readonly Address[];
}) => {
  const credit = useQuery({
    queryKey: ['portfolioCustody', 'credit', userId, safeAddress, ...creditModules],
    queryFn: () => readCreditCustody(safeAddress!, creditModules),
    enabled: !!safeAddress,
    staleTime: CUSTODY_POLL_MS / 2,
    refetchInterval: CUSTODY_POLL_MS,
    refetchIntervalInBackground: false,
  });
  const locked = useQuery({
    queryKey: ['portfolioCustody', 'lock', userId, safeAddress, lockAddress],
    queryFn: () => readLockedFuse(safeAddress!, lockAddress ?? null),
    enabled: !!safeAddress && lockAddress !== undefined,
    staleTime: CUSTODY_POLL_MS / 2,
    refetchInterval: CUSTODY_POLL_MS,
    refetchIntervalInBackground: false,
  });
  return { credit, locked };
};
