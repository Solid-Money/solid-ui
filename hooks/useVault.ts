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
import { selectIsRealtimeLive, useRealtimeStore } from '@/store/useRealtimeStore';

// Cache configuration for vault queries
const VAULT_STALE_TIME = secondsToMilliseconds(15); // Consider data fresh for 15 seconds
const VAULT_GC_TIME = secondsToMilliseconds(300); // Keep in cache for 5 minutes
/**
 * How often the polled vault totals re-read the chain. The Ethereum and Base
 * legs are `eth_call`s on the app's Alchemy key, billed per call, so this is
 * only the safety net: a balance event on the realtime socket refetches every
 * ['vault'] query at once (see lib/realtime and refreshAccountQueries), and
 * deposits and withdrawals refresh them directly. Faster while the socket is
 * down, when polling is all there is.
 */
const VAULT_POLL_MS = secondsToMilliseconds(15);
const VAULT_LIVE_POLL_MS = secondsToMilliseconds(60);

const useVaultRefetchInterval = () =>
  useRealtimeStore(selectIsRealtimeLive) ? VAULT_LIVE_POLL_MS : VAULT_POLL_MS;

export const VAULT = 'vault';

const fetchVaultBalanceWei = (
  queryClient: QueryClient,
  safeAddress: Address,
  chainId: number,
  vaultAddress: Address,
) =>
  queryClient.fetchQuery({
    ...readContractQueryOptions(config, {
      abi: FuseVault,
      address: vaultAddress,
      functionName: 'balanceOf',
      args: [safeAddress],
      chainId: chainId,
    }),
    // Always read the chain (concurrent reads of one vault still share a
    // request): the vault queries are refetched when SSE reports a balance
    // change, and a read cached from just before the transaction would answer
    // that refetch with the old balance until the next poll.
    staleTime: 0,
  });

export const fetchVaultBalance = async (
  queryClient: QueryClient,
  safeAddress: Address,
  chainId: number,
  vaultAddress: Address,
  decimals = 6,
) => {
  const balance = await fetchVaultBalanceWei(queryClient, safeAddress, chainId, vaultAddress);
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

// soFUSE and soETH have 18 decimals, more than a JS number holds, so these two
// return the raw wei balance and leave formatting to the caller.
export const useSoFuseVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [VAULT, 'balanceSoFuseWei', safeAddress],
    queryFn: () =>
      fetchVaultBalanceWei(queryClient, safeAddress, fuse.id, ADDRESSES.fuse.fuseVault),
    enabled: !!safeAddress,
    staleTime: VAULT_STALE_TIME,
    gcTime: VAULT_GC_TIME,
  });
};

export const useSoEthVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [VAULT, 'balanceSoEthWei', safeAddress],
    queryFn: () =>
      fetchVaultBalanceWei(queryClient, safeAddress, fuse.id, ADDRESSES.fuse.soEthVault),
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
  const refetchInterval = useVaultRefetchInterval();
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
    refetchInterval,
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
  const refetchInterval = useVaultRefetchInterval();
  return useQuery({
    queryKey: [VAULT, 'balanceTotal', safeAddress],
    queryFn: async () => {
      let total = 0;
      for (const vault of VAULTS) {
        const balances = await Promise.all(
          (vault.vaults ?? []).map(v =>
            fetchVaultBalance(queryClient, safeAddress, v.chainId, v.address, vault.decimals),
          ),
        );
        total += balances.reduce((acc, curr) => acc + curr, 0);
      }
      return total;
    },
    enabled: !!safeAddress,
    staleTime: VAULT_STALE_TIME,
    gcTime: VAULT_GC_TIME,
    refetchInterval,
  });
};
