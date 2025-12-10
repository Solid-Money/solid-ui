import { USDC_STARGATE } from '@/constants/addresses';
import { FastWithdrawManager_ABI } from '@/lib/abis/FastWithdrawManager';
import { getStargateQuote } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { StargateQuoteParams } from '@/lib/types';
import { getStargateChainKey, getStargateToken } from '@/lib/utils/stargate';
import { fuseConfig } from '@/lib/wagmi';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address } from 'abitype';
import { parseUnits } from 'viem';
import { readContractQueryOptions } from 'wagmi/query';

export const usePreviewFastWithdraw = (amount: string, oft: Address, chainId: number) => {
  const queryClient = useQueryClient();

  const {
    data: amountOut,
    isLoading,
    error,
  } = useQuery({
    queryKey: [FastWithdrawManager_ABI, 'previewFastWithdraw', oft, amount, chainId],
    queryFn: () => {
      const formattedAmount = parseUnits(amount, 6);
      return previewFastWithdraw(queryClient, oft, formattedAmount, chainId);
    },
    enabled: !!amount && !!oft && Number(amount) > 0 && !isNaN(Number(amount)) && !!chainId,
    retry: 1,
  });
  return { amountOut, isLoading, error };
};

export const previewFastWithdraw = async (
  queryClient: QueryClient,
  oft: Address,
  amount: bigint,
  chainId: number,
) => {
  try {
    if (chainId !== 122) {
      const dstAmountMin = (amount * 99n) / 100n;

      const quoteParams: StargateQuoteParams = {
        srcToken: USDC_STARGATE,
        srcChainKey: 'fuse', // Fuse chain key
        dstToken: getStargateToken(chainId) as string,
        dstChainKey: getStargateChainKey(chainId) as string,
        srcAddress: ADDRESSES.fuse.bridgePaymasterAddress,
        dstAddress: USDC_STARGATE,
        srcAmount: amount.toString(),
        dstAmountMin: dstAmountMin.toString(),
      };
      const quote = await getStargateQuote(quoteParams);
      const taxiQuote = quote.quotes.find(q => q.route.includes('taxi'));

      if (!taxiQuote) {
        throw new Error('Taxi route not available from Stargate');
      }

      if (taxiQuote.error) {
        throw new Error(`Stargate quote error: ${taxiQuote.error}`);
      }

      // Get the transaction from the first step (should be the bridge step)
      const bridgeStep = taxiQuote.steps.find(step => step.type === 'bridge');

      if (!bridgeStep) {
        throw new Error('No bridge step found in Stargate quote');
      }

      const { transaction } = bridgeStep;
      const nativeFeeAmount = transaction.value;
      const result = await queryClient.fetchQuery({
        ...readContractQueryOptions(fuseConfig, {
          abi: FastWithdrawManager_ABI,
          address: ADDRESSES.fuse.fastWithdrawManager,
          functionName: 'previewFastWithdraw',
          args: [oft, nativeFeeAmount, amount.toString()],
        }),
      });
      const [amountOut, feeAmount, amountOutBeforePremium] = result as [bigint, bigint, bigint];
      const minAmountOut = (amountOut * (10n ** 4n - 6n)) / 10n ** 4n;

      return { minAmountOut, feeAmount, amountOutBeforePremium };
    } else {
      const result = await queryClient.fetchQuery({
        ...readContractQueryOptions(fuseConfig, {
          abi: FastWithdrawManager_ABI,
          address: ADDRESSES.fuse.fastWithdrawManager,
          functionName: 'previewFastWithdraw',
          args: [oft, '0', amount.toString()],
        }),
      });
      const [amountOut, feeAmount, amountOutBeforePremium] = result as [bigint, bigint, bigint];
      return { minAmountOut: amountOut, feeAmount, amountOutBeforePremium };
    }
  } catch (error) {
    console.error('Preview fast withdraw error:', error);
    throw error;
  }
};
