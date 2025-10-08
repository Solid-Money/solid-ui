import { CardDepositManager_ABI } from '@/lib/abis/CardDepositManager';
import { ADDRESSES } from '@/lib/config';
import { fuseConfig } from '@/lib/wagmi';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address } from 'abitype';
import { formatUnits, parseUnits } from 'viem';
import { readContractQueryOptions } from 'wagmi/query';

export const usePreviewDepositToCard = (amount: string, oft: Address) => {
  const queryClient = useQueryClient();

  const {
    data: amountOut,
    isLoading,
    error,
  } = useQuery({
    queryKey: [CardDepositManager_ABI, 'previewDepositToCard', oft, amount],
    queryFn: () => {
      const formattedAmount = parseUnits(amount, 6);
      return previewSwap(queryClient, oft, formattedAmount);
    },
    enabled: !!amount && !!oft && Number(amount) > 0 && !isNaN(Number(amount)),
    retry: 1,
  });
  return { amountOut, isLoading, error };
};

export const previewSwap = async (queryClient: QueryClient, oft: Address, amount: bigint) => {
  try {
    const amountOut: bigint = await queryClient.fetchQuery({
      ...readContractQueryOptions(fuseConfig, {
        abi: CardDepositManager_ABI,
        address: ADDRESSES.fuse.cardDepositManager,
        functionName: 'previewSwap',
        args: [oft, amount.toString()],
      }),
    });
    return formatUnits(amountOut, 6);
  } catch (error) {
    console.error('Preview swap error:', error);
    throw error;
  }
};
