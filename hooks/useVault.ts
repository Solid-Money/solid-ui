import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { Address, formatUnits } from "viem";
import { fuse, mainnet } from "viem/chains";
import { readContractQueryOptions } from "wagmi/query";

import FuseVault from "@/lib/abis/FuseVault";
import { ADDRESSES } from "@/lib/config";
import { config } from "@/lib/wagmi";

const VAULT = "vault";

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
      functionName: "balanceOf",
      args: [safeAddress],
      chainId: chainId,
    }),
  );

  return Number(formatUnits(balance, decimals)) || 0;
};

export const useFuseVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [VAULT, "balanceFuse", safeAddress],
    queryFn: () =>
      fetchVaultBalance(
        queryClient,
        safeAddress,
        fuse.id,
        ADDRESSES.fuse.vault,
      ),
    enabled: !!safeAddress,
    refetchOnWindowFocus: false,
  });
};

export const useEthereumVaultBalance = (safeAddress: Address) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [VAULT, "balanceEthereum", safeAddress],
    queryFn: () =>
      fetchVaultBalance(
        queryClient,
        safeAddress,
        mainnet.id,
        ADDRESSES.ethereum.vault,
      ),
    enabled: !!safeAddress,
    refetchOnWindowFocus: false,
  });
};
