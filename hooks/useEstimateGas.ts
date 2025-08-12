import { fetchTokenPriceUsd } from '@/lib/api';
import { publicClient } from '@/lib/wagmi';
import { useEffect, useState } from 'react';
import { mainnet } from 'viem/chains';

export const useEstimateGas = (
  gasEstimate: bigint = 700000n,
  bridgeFee: bigint = 0n,
  chainId: number = mainnet.id,
  token: string = 'ETH',
) => {
  const [costInUsd, setCostInUsd] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const estimateGas = async () => {
      setLoading(true);

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

      setCostInUsd(finalCostInUsd);
      setLoading(false);
    };
    estimateGas();
  }, []);

  return { costInUsd, loading };
};
