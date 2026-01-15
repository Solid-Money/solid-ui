import { useQuery } from '@tanstack/react-query';
import { mainnet } from 'viem/chains';

import { fetchTokenPriceUsd } from '@/lib/api';
import { publicClient } from '@/lib/wagmi';

const GAS_ESTIMATE_KEY = 'gas-estimate';

async function estimateGasCost(
  gasEstimate: bigint,
  bridgeFee: bigint,
  chainId: number,
  token: string,
): Promise<number> {
  const feeData = await publicClient(chainId).estimateFeesPerGas();
  const baseGasPrice =
    feeData.maxFeePerGas || feeData.gasPrice || (await publicClient(chainId).getGasPrice());

  // Apply fast gas price multiplier
  const fastGasPrice = (baseGasPrice * 195n) / 100n; // 85% above base for fast transactions

  const tokenPriceUsd = await fetchTokenPriceUsd(token);

  const gasCostInWei = gasEstimate * fastGasPrice;

  const totalCostInWei = gasCostInWei + bridgeFee;
  const totalCostInEth = Number(totalCostInWei) / 10 ** 18;
  const finalCostInUsd = totalCostInEth * Number(tokenPriceUsd);

  return finalCostInUsd;
}

export const useEstimateGas = (
  gasEstimate: bigint = 700000n,
  bridgeFee: bigint = 0n,
  chainId: number = mainnet.id,
  token: string = 'ETH',
) => {
  const { data: costInUsd = 0, isLoading: loading } = useQuery({
    queryKey: [
      GAS_ESTIMATE_KEY,
      chainId,
      token,
      gasEstimate.toString(),
      bridgeFee.toString(),
    ],
    queryFn: () => estimateGasCost(gasEstimate, bridgeFee, chainId, token),
    staleTime: 30 * 1000, // 30s - gas prices change frequently
    gcTime: 60 * 1000, // 1 minute
  });

  return { costInUsd, loading };
};
