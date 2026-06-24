import { useQuery } from '@tanstack/react-query';
import { erc20Abi } from 'viem';
import { mainnet } from 'viem/chains';

import { Holding } from '@/components/Stocks/stocksData';
import { XSTOCKS_TOKENS } from '@/constants/xstocksTokens';
import { publicClient } from '@/lib/wagmi';

import useUser from './useUser';

const DECIMALS = 18n;
const SCALE = 1_000_000n; // 6 decimal places of precision in BigInt domain

async function fetchXStockHoldings(safeAddress: `0x${string}`): Promise<Holding[]> {
  const client = publicClient(mainnet.id);

  const results = await client.multicall({
    contracts: XSTOCKS_TOKENS.map(token => ({
      address: token.contractAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [safeAddress] as const,
    })),
    allowFailure: true,
  });

  const holdings: Holding[] = [];

  for (let i = 0; i < XSTOCKS_TOKENS.length; i++) {
    const result = results[i];
    if (result.status !== 'success') continue;

    const rawBalance = result.result as bigint;
    if (rawBalance === 0n) continue;

    const token = XSTOCKS_TOKENS[i];
    // BigInt arithmetic avoids float precision loss for large atom counts
    const scaled = (rawBalance * SCALE) / 10n ** DECIMALS;
    const shares = Number(scaled) / Number(SCALE);
    if (shares <= 0) continue;

    holdings.push({
      ticker: token.symbol,
      name: token.name,
      shares,
      changePercent: 0,
      logoColor: '#1c1c1c',
      avgCost: 0,
      contractAddress: token.contractAddress,
    });
  }

  return holdings;
}

export function useXStockHoldings() {
  const { user } = useUser();

  const { data = [], isLoading } = useQuery({
    queryKey: ['xstockHoldings', user?.safeAddress],
    queryFn: () => fetchXStockHoldings(user!.safeAddress! as `0x${string}`),
    enabled: !!user?.safeAddress,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  return { holdings: data as Holding[], isLoading };
}
