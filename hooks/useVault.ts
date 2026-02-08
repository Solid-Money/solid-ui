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

export const useSoFuseVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [VAULT, 'balanceSoFuse', safeAddress],
    queryFn: () =>
      fetchVaultBalance(
        queryClient,
        safeAddress,
        fuse.id,
        ADDRESSES.fuse.fuseVault,
        18,
      ),
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
  });
};
