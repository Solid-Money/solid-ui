import { Text } from '@/components/ui/text';
import { ALGEBRA_ROUTER } from '@/constants/addresses';
import { MAX_UINT128 } from '@/constants/max-uint128';
import { algebraBasePluginAbi, algebraPoolAbi } from '@/generated/wagmi';
import usePegSwapCallback, { PegSwapType } from '@/hooks/swap/usePegswapCallback';
import { usePoolPlugins } from '@/hooks/swap/usePoolPlugins';
import useWrapCallback, { WrapType } from '@/hooks/swap/useWrapCallback';
import { ChevronDown } from '@/lib/icons/ChevronDown';
import { ChevronRight } from '@/lib/icons/ChevronRight';
import { SwapField } from '@/lib/types/swap-field';
import { TradeState } from '@/lib/types/trade-state';
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
import { Loader2, ZapIcon } from 'lucide-react-native';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Address, getContract } from 'viem';
import { fuse } from 'viem/chains';

const SwapParams = () => {
  const {
    tradeState,
    toggledTrade: trade,
    allowedSlippage,
    poolAddress,
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

  const { dynamicFeePlugin } = usePoolPlugins(poolAddress);

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
          } catch (error) {
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

  return trade ? (
    <View>
      <View className="flex flex-row justify-between">
        <Pressable
          className="flex flex-row items-center w-full mb-1 text-center py-1 px-6"
          onPress={() => toggleExpanded(!isExpanded)}
        >
          {slidingFee && (
            <div className="rounded select-none pointer px-1.5 py-1 flex items-center relative">
              {dynamicFeePlugin && (
                <ZapIcon className="mr-2" strokeWidth={1} stroke="white" fill="white" size={16} />
              )}
              <span>{`${slidingFee?.toFixed(4)}% fee`}</span>
            </div>
          )}
          <View className={`ml-auto ${isExpanded && 'rotate-180'}`}>
            <ChevronDown strokeWidth={2} size={16} className="text-foreground" />
          </View>
        </Pressable>
      </View>
      <View className={`overflow-hidden ${isExpanded ? 'h-auto' : 'h-0'}`}>
        <View className="flex flex-col gap-2.5 px-[30px] py-2 rounded-xl">
          <View className="flex flex-row items-center justify-between">
            <Text className="font-semibold text-sm">Route</Text>
            <View>
              <SwapRoute trade={trade} />
            </View>
          </View>
          <View className="flex flex-row items-center justify-between">
            <Text className="font-semibold text-sm">
              {trade.tradeType === TradeType.EXACT_INPUT ? 'Minimum received' : 'Maximum sent'}
            </Text>
            <Text className="text-sm">
              {isVoltageTrade && !isVoltageTradeLoading
                ? computeSlippageAdjustedAmounts(voltageTrade?.trade, allowedSlippage)[
                    trade.tradeType === TradeType.EXACT_INPUT ? 'outputAmount' : 'inputAmount'
                  ]?.toSignificant(6)
                : trade.tradeType === TradeType.EXACT_INPUT
                  ? `${trade.minimumAmountOut(allowedSlippage).toSignificant(6)} ${trade.outputAmount.currency.symbol}`
                  : `${trade.maximumAmountIn(allowedSlippage).toSignificant(6)} ${trade.inputAmount.currency.symbol}`}
            </Text>
          </View>
          <View className="flex flex-row items-center justify-between">
            <Text className="font-semibold text-sm">LP Fee</Text>
            <Text className="text-sm">{LPFeeString}</Text>
          </View>
          <View className="flex flex-row items-center justify-between">
            <Text className="font-semibold text-sm">Price impact</Text>
            <View>
              <PriceImpact priceImpact={priceImpact} />
            </View>
          </View>
          <View className="flex flex-row items-center justify-between">
            <Text className="font-semibold text-sm">Slippage tolerance</Text>
            <Text className="text-sm">{allowedSlippage.toFixed(2)}%</Text>
          </View>
        </View>
      </View>
    </View>
  ) : trade !== undefined || tradeState.state === TradeState.LOADING ? (
    <View className="flex flex-row justify-center mb-1 py-3 px-3">
      <Loader2 size={17} className="text-foreground animate-spin" />
    </View>
  ) : null;
};

const SwapRoute = ({ trade }: { trade: Trade<Currency, Currency, TradeType> }) => {
  const path = trade.route.tokenPath;

  return (
    <View className="flex flex-row items-center gap-1">
      {path.map((token, idx, path) => (
        <Fragment key={`token-path-${idx}`}>
          <Text className="text-sm">{unwrappedToken(token).symbol}</Text>
          {idx === path.length - 1 ? null : <ChevronRight size={16} className="text-foreground" />}
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
    <Text className={`text-sm ${color}`}>
      {priceImpact ? `${priceImpact.multiply(-1).toFixed(2)}%` : '-'}
    </Text>
  );
};

export default SwapParams;
