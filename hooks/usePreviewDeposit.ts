import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseUnits } from 'viem';
import { fuse, mainnet } from 'viem/chains';
import { readContractQueryOptions } from 'wagmi/query';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import Accountant from '@/lib/abis/Accountant';
import { getLifiQuote } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { config } from '@/lib/wagmi';

export const usePreviewDeposit = (amount: string, tokenAddress?: string, chainId?: number) => {
  const queryClient = useQueryClient();

  const { data: exchangeRate, isLoading: isExchangeRateLoading } = useQuery({
    queryKey: [Accountant, 'previewDeposit'],
    queryFn: () => fetchExchangeRate(queryClient),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const mainnetUsdcAddress = BRIDGE_TOKENS[mainnet.id]?.tokens?.USDC?.address;
  const isMainnetUsdc =
    chainId === mainnet.id && tokenAddress?.toLowerCase() === mainnetUsdcAddress?.toLowerCase();

  const currentChainUsdcAddress = BRIDGE_TOKENS[chainId || 0]?.tokens?.USDC?.address;
  const isUsdc =
    tokenAddress &&
    currentChainUsdcAddress &&
    tokenAddress.toLowerCase() === currentChainUsdcAddress.toLowerCase();

  const shouldFetchLifi =
    !!amount && Number(amount) > 0 && !!tokenAddress && !!chainId && !isMainnetUsdc && !isUsdc;

  const { data: lifiAmountOut, isLoading: isLifiLoading } = useQuery({
    queryKey: ['lifiQuote', amount, tokenAddress, chainId],
    queryFn: async () => {
      if (!tokenAddress || !chainId || !mainnetUsdcAddress) return '0';
      // Assuming 6 decimals for input token (USDC/USDT) as per existing logic
      const fromAmount = parseUnits(amount, 6);

      const quote = await getLifiQuote({
        fromChain: chainId,
        toChain: mainnet.id,
        fromToken: tokenAddress,
        toToken: mainnetUsdcAddress,
        fromAmount,
        fromAddress: tokenAddress,
        toAddress: tokenAddress,
      });
      return quote?.estimate?.toAmount || '0';
    },
    enabled: shouldFetchLifi,
    staleTime: 30 * 1000, // 30 seconds
  });

  let estimatedUsdcAmount = 0;
  if (isMainnetUsdc || isUsdc) {
    estimatedUsdcAmount = Number(amount) * 10 ** 6;
  } else if (lifiAmountOut) {
    estimatedUsdcAmount = Number(lifiAmountOut);
  }

  const amountOut = exchangeRate ? estimatedUsdcAmount / Number(exchangeRate) : 0;

  const amountInUsdc = Number(amount) * 10 ** 6; // approximate for display purposes, assuming stablecoin input for now or if input is already USDC value
  const routingFee =
    !isMainnetUsdc && !isUsdc && estimatedUsdcAmount > 0 && amountInUsdc > estimatedUsdcAmount
      ? (amountInUsdc - estimatedUsdcAmount) / 10 ** 6
      : 0;

  return {
    amountOut,
    isLoading: isExchangeRateLoading || isLifiLoading,
    exchangeRate,
    routingFee,
  };
};

export const fetchExchangeRate = async (queryClient: QueryClient) => {
  const exchangeRate = await queryClient.fetchQuery({
    ...readContractQueryOptions(config, {
      abi: Accountant,
      address: ADDRESSES.ethereum.accountant,
      functionName: 'getRate',
      chainId: 1,
    }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  return exchangeRate;
};

export const fetchExchangeRatesoFuse = async (queryClient: QueryClient) => {
  const exchangeRate = await queryClient.fetchQuery({
    ...readContractQueryOptions(config, {
      abi: Accountant,
      address: ADDRESSES.fuse.fuseAccountant,
      functionName: 'getRate',
      chainId: fuse.id,
    }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  return exchangeRate;
};
