import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { secondsToMilliseconds } from 'date-fns';
import { Address, formatUnits } from 'viem';
import { fuse, mainnet } from 'viem/chains';
import { readContractQueryOptions } from 'wagmi/query';

import { VAULTS } from '@/constants/vaults';
import FuseVault from '@/lib/abis/FuseVault';
import { ADDRESSES } from '@/lib/config';
import { Vault } from '@/lib/types';
import { config } from '@/lib/wagmi';

// Cache configuration for vault queries.
//
// These are a *fallback*, not the live path: `useActivitySSE` invalidates the
// `vault` keys as soon as a balance event arrives (debounced 200ms for
// deposits), so a balance still updates in near real time without polling.
// Polling every 3s only mattered when the stream was down — and at that rate
// each active client was issuing ~100 contract reads a minute, on every screen
// that watches a vault, forever.
const VAULT_STALE_TIME = secondsToMilliseconds(15); // Consider data fresh for 15 seconds
const VAULT_GC_TIME = secondsToMilliseconds(300); // Keep in cache for 5 minutes
const VAULT_REFETCH_INTERVAL = secondsToMilliseconds(30); // Fallback poll; SSE drives live updates

export const VAULT = 'vault';

export const fetchVaultBalance = async (
  queryClient: QueryClient,
  safeAddress: Address,
  chainId: number,
  vaultAddress: Address,
  decimals = 6,
) => {
  const balance = await queryClient.fetchQuery({
    ...readContractQueryOptions(config, {
      abi: FuseVault,
      address: vaultAddress,
      functionName: 'balanceOf',
      args: [safeAddress],
      chainId: chainId,
    }),
    staleTime: VAULT_STALE_TIME,
  });

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

export const useSoFuseVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [VAULT, 'balanceSoFuse', safeAddress],
    queryFn: () =>
      fetchVaultBalance(queryClient, safeAddress, fuse.id, ADDRESSES.fuse.fuseVault, 18),
    enabled: !!safeAddress,
    staleTime: VAULT_STALE_TIME,
    gcTime: VAULT_GC_TIME,
  });
};

export const useSoEthVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [VAULT, 'balanceSoEth', safeAddress],
    queryFn: () =>
      fetchVaultBalance(queryClient, safeAddress, fuse.id, ADDRESSES.fuse.soEthVault, 18),
    enabled: !!safeAddress,
    staleTime: VAULT_STALE_TIME,
    gcTime: VAULT_GC_TIME,
  });
};

export const useEthereumSoEthVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [VAULT, 'balanceSoEthEthereum', safeAddress],
    queryFn: () =>
      fetchVaultBalance(queryClient, safeAddress, mainnet.id, ADDRESSES.ethereum.soEthVault, 18),
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

export const useVaultBalance = (safeAddress: Address, vault?: Vault) => {
  const queryClient = useQueryClient();
  const selectedVault = vault || VAULTS[0];

  return useQuery({
    queryKey: [VAULT, 'balance', safeAddress, selectedVault.name],
    queryFn: async () => {
      const balances = await Promise.all(
        selectedVault.vaults?.map(v =>
          fetchVaultBalance(queryClient, safeAddress, v.chainId, v.address, selectedVault.decimals),
        ),
      );
      const totalBalance = balances.reduce((acc, curr) => acc + curr, 0);
      return totalBalance;
    },
    enabled: !!safeAddress,
    staleTime: VAULT_STALE_TIME,
    gcTime: VAULT_GC_TIME,
    refetchInterval: VAULT_REFETCH_INTERVAL,
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

/** Total balance across all vaults (USDC + FUSE + ETH). Use for empty-state checks. */
export const useTotalVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [VAULT, 'balanceTotal', safeAddress],
    queryFn: async () => {
      // One round trip for every vault on every chain, rather than a round per
      // vault: the reads are independent, so awaiting each vault's group in turn
      // made this as slow as the sum of the chains instead of the slowest one.
      const balances = await Promise.all(
        VAULTS.flatMap(vault =>
          (vault.vaults ?? []).map(v =>
            fetchVaultBalance(queryClient, safeAddress, v.chainId, v.address, vault.decimals),
          ),
        ),
      );
      return balances.reduce((acc, curr) => acc + curr, 0);
    },
    enabled: !!safeAddress,
    staleTime: VAULT_STALE_TIME,
    gcTime: VAULT_GC_TIME,
    refetchInterval: VAULT_REFETCH_INTERVAL,
  });
};
