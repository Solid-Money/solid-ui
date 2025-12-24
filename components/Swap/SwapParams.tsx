import { Text } from '@/components/ui/text';
import { ALGEBRA_ROUTER } from '@/constants/addresses';
import { MAX_UINT128 } from '@/constants/max-uint128';
import { algebraBasePluginAbi, algebraPoolAbi } from '@/generated/wagmi';
import usePegSwapCallback, { PegSwapType } from '@/hooks/swap/usePegswapCallback';
import useWrapCallback, { WrapType } from '@/hooks/swap/useWrapCallback';
import { ChevronDown } from '@/lib/icons/ChevronDown';
import { ChevronRight } from '@/lib/icons/ChevronRight';
import { SwapField } from '@/lib/types/swap-field';
import { TradeState } from '@/lib/types/trade-state';
import { cn } from '@/lib/utils';
import {
  computeRealizedLPFeePercent,
  computeSlippageAdjustedAmounts,
  warningSeverity,
} from '@/lib/utils/swap/prices';
import { publicClient } from '@/lib/wagmi';
import { useDerivedSwapInfo, useSwapState } from '@/store/swapStore';
import {
  ADDRESS_ZERO,
  computePoolAddress,
  Currency,
  Percent,
  Trade,
  TradeType,
  unwrappedToken,
} from '@cryptoalgebra/fuse-sdk';
import * as Sentry from '@sentry/react-native';
import { Fuel } from 'lucide-react-native';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Address, getContract } from 'viem';
import { fuse } from 'viem/chains';

const SwapParams = () => {
  const {
    tradeState,
    toggledTrade: trade,
    allowedSlippage,
    currencies,
    voltageTrade,
    isVoltageTrade,
    isVoltageTradeLoading,
  } = useDerivedSwapInfo();
  const { typedValue } = useSwapState();

  const { wrapType } = useWrapCallback(
    currencies[SwapField.INPUT],
    currencies[SwapField.OUTPUT],
    typedValue,
  );

  const { pegSwapType } = usePegSwapCallback(
    currencies[SwapField.INPUT],
    currencies[SwapField.OUTPUT],
    typedValue,
  );

  const [isExpanded, toggleExpanded] = useState(false);
  const [slidingFee, setSlidingFee] = useState<number>();

  useEffect(() => {
    async function getFees() {
      if (!trade || !tradeState.fee) return;

      const fees = [];

      // TODO: use correct value
      const isZeroToOne = false;

      for (const route of trade.swaps) {
        for (const pool of route.route.pools) {
          const address = computePoolAddress({
            tokenA: pool.token0,
            tokenB: pool.token1,
          }) as Address;

          const poolContract = getContract({
            client: publicClient(fuse.id),
            abi: algebraPoolAbi,
            address,
          });
          const plugin = await poolContract.read.plugin();

          const pluginContract = getContract({
            client: publicClient(fuse.id),
            abi: algebraBasePluginAbi,
            address: plugin,
          });

          let beforeSwap: [string, number, number];

          try {
            beforeSwap = await pluginContract.simulate
              .beforeSwap(
                [
                  ALGEBRA_ROUTER,
                  ADDRESS_ZERO,
                  isZeroToOne,
                  trade.tradeType === TradeType.EXACT_INPUT
                    ? BigInt(trade?.inputAmount.quotient.toString())
                    : BigInt(trade?.outputAmount.quotient.toString()),
                  MAX_UINT128,
                  false,
                  '0x',
                ],
                { account: address },
              )
              .then(v => v.result as [string, number, number]);
          } catch (_error) {
            console.warn('Failed to get beforeSwap data:', _error);
            const address = computePoolAddress({
              tokenA: pool.token0,
              tokenB: pool.token1,
            }) as Address;
            Sentry.captureException(_error, {
              tags: {
                type: 'before_swap_data_error',
              },
              extra: {
                poolAddress: address,
                tokenIn: pool?.token0.symbol,
                tokenOut: pool?.token1.symbol,
                tradeType: trade?.tradeType,
              },
              level: 'warning',
            });
            beforeSwap = ['', 0, 0];
          }
          const [, overrideFee, pluginFee] = beforeSwap || ['', 0, 0];

          if (overrideFee) {
            fees.push(overrideFee + pluginFee);
          } else {
            fees.push(pool.fee + pluginFee);
          }
        }
      }

      let p = 100;
      for (const fee of fees) {
        p *= 1 - Number(fee) / 1_000_000;
      }

      setSlidingFee(100 - p);
    }

    getFees();
  }, [trade, tradeState.fee]);

  const { realizedLPFee, priceImpact } = useMemo(() => {
    if (!trade) return { realizedLPFee: undefined, priceImpact: undefined };

    const realizedLpFeePercent = computeRealizedLPFeePercent(trade);
    const realizedLPFee = trade.inputAmount.multiply(realizedLpFeePercent);
    const priceImpact = isVoltageTrade
      ? voltageTrade?.trade?.priceImpact
      : trade.priceImpact.subtract(realizedLpFeePercent);
    return { priceImpact, realizedLPFee };
  }, [trade, isVoltageTrade, voltageTrade]);

  const LPFeeString = realizedLPFee
    ? `${realizedLPFee.toSignificant(4)} ${realizedLPFee.currency.symbol}`
    : '-';

  if (wrapType !== WrapType.NOT_APPLICABLE) return;

  if (pegSwapType !== PegSwapType.NOT_APPLICABLE) return;

  if (!trade) {
    if (tradeState.state === TradeState.LOADING) {
      return (
        <View className="flex flex-row justify-center px-3">
          <ActivityIndicator size={17} color="white" />
        </View>
      );
    }

    return (
      <View className="flex flex-row items-center justify-between px-1 mt-4">
        <View className="flex-row items-center gap-2">
          <Fuel strokeWidth={1} stroke="white" size={16} />
          <Text className="text-base text-white/70 font-semibold">Fee</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-bold">0 USDC</Text>
          <ChevronDown strokeWidth={2} size={16} className="text-foreground" />
        </View>
      </View>
    );
  }

  return (
    <View>
      <Pressable
        className="flex flex-row items-center justify-between w-full web:hover:opacity-70"
        onPress={() => toggleExpanded(!isExpanded)}
      >
        <View className="flex-row items-center gap-2">
          <Fuel strokeWidth={1} stroke="white" size={16} />
          <Text className="text-base text-white/70 font-semibold">Fee</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-bold">{LPFeeString}</Text>
          <View className={cn({ 'rotate-180': isExpanded })}>
            <ChevronDown strokeWidth={2} size={16} className="text-foreground" />
          </View>
        </View>
      </Pressable>
      <View
        className={cn('overflow-hidden', {
          'h-auto': isExpanded,
          'h-0': !isExpanded,
        })}
      >
        <View className="flex flex-col gap-2.5 bg-card rounded-xl mt-6">
          <View className="flex flex-row items-center justify-between p-4 md:p-6 border-b border-white/10">
            <Text className="text-base text-white/70 font-medium">Route</Text>
            <View>
              <SwapRoute trade={trade} />
            </View>
          </View>
          <View className="flex flex-row items-center justify-between p-4 md:p-6 border-b border-white/10">
            <Text className="text-base text-white/70 font-medium">
              {trade.tradeType === TradeType.EXACT_INPUT ? 'Minimum received' : 'Maximum sent'}
            </Text>
            <Text className="text-base font-semibold">
              {isVoltageTrade && !isVoltageTradeLoading
                ? computeSlippageAdjustedAmounts(voltageTrade?.trade, allowedSlippage)[
                    trade.tradeType === TradeType.EXACT_INPUT ? 'outputAmount' : 'inputAmount'
                  ]?.toSignificant(6)
                : trade.tradeType === TradeType.EXACT_INPUT
                  ? `${trade.minimumAmountOut(allowedSlippage).toSignificant(6)} ${trade.outputAmount.currency.symbol}`
                  : `${trade.maximumAmountIn(allowedSlippage).toSignificant(6)} ${trade.inputAmount.currency.symbol}`}
            </Text>
          </View>
          <View className="flex flex-row items-center justify-between p-4 md:p-6 border-b border-white/10">
            <Text className="text-base text-white/70 font-medium">Sliding Fee</Text>
            <Text className="text-base font-semibold">
              {slidingFee ? `${slidingFee.toFixed(4)}%` : '-'}
            </Text>
          </View>
          <View className="flex flex-row items-center justify-between p-4 md:p-6 border-b border-white/10">
            <Text className="text-base text-white/70 font-medium">Price impact</Text>
            <View>
              <PriceImpact priceImpact={priceImpact} />
            </View>
          </View>
          <View className="flex flex-row items-center justify-between p-4 md:p-6">
            <Text className="text-base text-white/70 font-medium">Slippage tolerance</Text>
            <Text className="text-base font-semibold">{allowedSlippage.toFixed(2)}%</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const SwapRoute = ({ trade }: { trade: Trade<Currency, Currency, TradeType> }) => {
  const path = trade.swaps[0].route.tokenPath;

  return (
    <View className="flex flex-row items-center gap-1">
      {path.map((token, idx, path) => (
        <Fragment key={`token-path-${idx}`}>
          <Text className="text-sm font-semibold">{unwrappedToken(token).symbol}</Text>
          {idx === path.length - 1 ? null : <ChevronRight size={16} className="text-white" />}
        </Fragment>
      ))}
    </View>
  );
};

const PriceImpact = ({ priceImpact }: { priceImpact: Percent | undefined }) => {
  const severity = warningSeverity(priceImpact);

  const color =
    severity === 3 || severity === 4
      ? 'text-red-400'
      : severity === 2
        ? 'text-yellow-400'
        : 'text-foreground';

  return (
    <Text className={cn('text-sm', color)}>
      {priceImpact ? `${priceImpact.multiply(-1).toFixed(2)}%` : '-'}
    </Text>
  );
};

export default SwapParams;
