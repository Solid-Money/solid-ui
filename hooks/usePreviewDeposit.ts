import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseUnits } from 'viem';
import { base, fuse, mainnet } from 'viem/chains';
import { readContractQueryOptions } from 'wagmi/query';

import { BRIDGE_TOKENS } from '@/constants/bridge';
import Accountant from '@/lib/abis/Accountant';
import { getLifiQuote } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { config } from '@/lib/wagmi';

/**
 * `ownerAddress` is the wallet the deposit comes from. LI.FI simulates the
 * route from it, so it must be a real holder: quoting from the token contract
 * itself reverted every time and the preview showed 0. Without one there is no
 * quote, and `isQuoteUnavailable` says so instead of reporting 0.
 */
export const usePreviewDeposit = (
  amount: string,
  tokenAddress?: string,
  chainId?: number,
  ownerAddress?: string,
  decimals = 6,
) => {
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

  const needsQuote =
    !!amount && Number(amount) > 0 && !!tokenAddress && !!chainId && !isMainnetUsdc && !isUsdc;
  const shouldFetchLifi = needsQuote && !!ownerAddress;

  const {
    data: lifiAmountOut,
    isLoading: isLifiLoading,
    isError: isLifiError,
  } = useQuery({
    queryKey: ['lifiQuote', amount, tokenAddress, chainId, ownerAddress, decimals],
    queryFn: async () => {
      if (!tokenAddress || !chainId || !mainnetUsdcAddress || !ownerAddress) return '0';
      const fromAmount = parseUnits(amount, decimals);

      const quote = await getLifiQuote({
        fromChain: chainId,
        toChain: mainnet.id,
        fromToken: tokenAddress,
        toToken: mainnetUsdcAddress,
        fromAmount,
        fromAddress: ownerAddress,
        toAddress: ownerAddress,
      });
      return quote?.estimate?.toAmount || '0';
    },
    enabled: shouldFetchLifi,
    staleTime: 30 * 1000, // 30 seconds
  });

  const isQuoteUnavailable =
    needsQuote && (!ownerAddress || isLifiError || (!!lifiAmountOut && Number(lifiAmountOut) <= 0));

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
    isQuoteUnavailable,
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
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
  });
  return exchangeRate;
};

export const fetchExchangeRateSoEth = async (queryClient: QueryClient) => {
  const exchangeRate = await queryClient.fetchQuery({
    ...readContractQueryOptions(config, {
      abi: Accountant,
      address: ADDRESSES.ethereum.soEthAccountant,
      functionName: 'getRate',
      chainId: 1,
    }),
    staleTime: 60_000,
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
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
  });
  return exchangeRate;
};

/** soEURC → EURC, 6 decimals, from the soEURC accountant on Base. */
export const fetchExchangeRateSoEurc = async (queryClient: QueryClient) => {
  const exchangeRate = await queryClient.fetchQuery({
    ...readContractQueryOptions(config, {
      abi: Accountant,
      address: ADDRESSES.base.soEurcAccountant,
      functionName: 'getRate',
      chainId: base.id,
    }),
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
  });
  return exchangeRate;
};
