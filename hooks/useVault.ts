import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { secondsToMilliseconds } from 'date-fns';
import { Address, formatUnits } from 'viem';
import { fuse, mainnet } from 'viem/chains';
import { readContractQueryOptions } from 'wagmi/query';

import FuseVault from '@/lib/abis/FuseVault';
import { ADDRESSES } from '@/lib/config';
import { config } from '@/lib/wagmi';

// Cache configuration for vault queries
const VAULT_STALE_TIME = secondsToMilliseconds(30); // Consider data fresh for 30 seconds
const VAULT_GC_TIME = secondsToMilliseconds(300); // Keep in cache for 5 minutes

const VAULT = 'vault';

export const fetchVaultBalance = async (
  queryClient: QueryClient,
  safeAddress: Address,
  chainId: number,
  vaultAddress: Address,
  decimals = 6,
) => {
  const balance = await queryClient.fetchQuery(
    readContractQueryOptions(config, {
      abi: FuseVault,
      address: vaultAddress,
      functionName: 'balanceOf',
      args: [safeAddress],
      chainId: chainId,
    }),
  );

  return Number(formatUnits(balance, decimals)) || 0;
};

export const useFuseVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [VAULT, 'balanceFuse', safeAddress],
    queryFn: () => fetchVaultBalance(queryClient, safeAddress, fuse.id, ADDRESSES.fuse.vault),
    enabled: !!safeAddress,
    staleTime: VAULT_STALE_TIME,
    gcTime: VAULT_GC_TIME,
  });
};

export const useEthereumVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [VAULT, 'balanceEthereum', safeAddress],
    queryFn: () =>
      fetchVaultBalance(queryClient, safeAddress, mainnet.id, ADDRESSES.ethereum.vault),
    enabled: !!safeAddress,
    staleTime: VAULT_STALE_TIME,
    gcTime: VAULT_GC_TIME,
  });
};

export const useVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [VAULT, 'balance', safeAddress],
    queryFn: async () => {
      // PERFORMANCE: Fetch both chains in parallel instead of sequentially
      // This reduces latency from ~2x RPC call time to ~1x RPC call time
      const [ethereumBalance, fuseBalance] = await Promise.all([
        fetchVaultBalance(queryClient, safeAddress, mainnet.id, ADDRESSES.ethereum.vault),
        fetchVaultBalance(queryClient, safeAddress, fuse.id, ADDRESSES.fuse.vault),
      ]);
      return ethereumBalance + fuseBalance;
    },
    enabled: !!safeAddress,
    staleTime: VAULT_STALE_TIME,
    gcTime: VAULT_GC_TIME,
  });
};

export const useUsdcVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [VAULT, 'balanceUsdc', safeAddress],
    queryFn: () => fetchVaultBalance(queryClient, safeAddress, mainnet.id, ADDRESSES.ethereum.usdc),
    enabled: !!safeAddress,
    staleTime: VAULT_STALE_TIME,
    gcTime: VAULT_GC_TIME,
  });
};
