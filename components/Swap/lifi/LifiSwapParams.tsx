import React, { Fragment, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ChevronDown, ChevronRight, Fuel } from 'lucide-react-native';
import { formatUnits } from 'viem';

import { Text } from '@/components/ui/text';
import { CHAIN_NAMES } from '@/constants/chains';
import { useLifiSwapInfo } from '@/hooks/swap/useLifiSwapInfo';
import { LifiRouteOrder, LifiSwapFee, LifiSwapQuote } from '@/lib/types/lifi-swap';
import { cn, formatNumber } from '@/lib/utils';
import {
  formatEta,
  formatUsd,
  lifiPriceImpact,
  lifiTotalCostUsd,
  sumFeesUsd,
} from '@/lib/utils/swap/lifi';
import { warningSeverity } from '@/lib/utils/swap/prices';

const tokenAmount = (raw: string, decimals: number) =>
  formatNumber(Number(formatUnits(BigInt(raw), decimals)), 6);

const WAIVE_COPY: Record<string, string> = {
  TierFree: 'Free on your tier',
  Disabled: 'Free',
};

/**
 * Fee breakdown for a swap that leaves Fuse.
 *
 * Collapsed, it reads as one figure: everything the swap costs, in dollars.
 * Expanded, every party's cut is on its own line: Solid, LI.FI, then each
 * bridge and DEX on the route. Fees taken out of the amount and fees paid on
 * top in gas token are kept apart, because only the second needs extra balance.
 */
const LifiSwapParams = () => {
  const { quote, isQuoting, slippage, routeOrder, setRouteOrder } = useLifiSwapInfo();
  const [isExpanded, setExpanded] = useState(false);

  if (!quote && !isQuoting) return null;

  return (
    <View className="gap-4">
      <RoutePreference value={routeOrder} onChange={setRouteOrder} />
      {quote ? (
        <QuoteSummary
          quote={quote}
          isQuoting={isQuoting}
          slippage={slippage}
          isExpanded={isExpanded}
          onToggle={() => setExpanded(!isExpanded)}
        />
      ) : (
        <View className="flex flex-row justify-center px-3">
          <ActivityIndicator size={17} color="white" />
        </View>
      )}
    </View>
  );
};

const ROUTE_OPTIONS: { value: LifiRouteOrder; label: string; hint: string }[] = [
  { value: 'CHEAPEST', label: 'Cheapest', hint: 'Lowest cost' },
  { value: 'FASTEST', label: 'Fastest', hint: 'Arrives soonest' },
];

/**
 * Which route LI.FI picks. Switching re-quotes, and the cost, fees, route and
 * time below all come from the new quote.
 */
const RoutePreference = ({
  value,
  onChange,
}: {
  value: LifiRouteOrder;
  onChange: (order: LifiRouteOrder) => void;
}) => (
  <View className="flex-row gap-2" accessibilityRole="radiogroup">
    {ROUTE_OPTIONS.map(option => {
      const selected = option.value === value;
      return (
        <Pressable
          key={option.value}
          onPress={() => !selected && onChange(option.value)}
          accessibilityRole="radio"
          accessibilityState={{ selected }}
          accessibilityLabel={`${option.label} route: ${option.hint}`}
          className={cn('flex-1 items-center rounded-xl border px-3 py-2', {
            'border-primary/60 bg-primary/15': selected,
            'border-accent/40 bg-accent/50 web:hover:bg-accent/30': !selected,
          })}
        >
          <Text
            className={cn('text-sm font-semibold', {
              'text-primary': selected,
              'text-foreground': !selected,
            })}
          >
            {option.label}
          </Text>
          <Text className="text-xs text-muted-foreground">{option.hint}</Text>
        </Pressable>
      );
    })}
  </View>
);

const QuoteSummary = ({
  quote,
  isQuoting,
  slippage,
  isExpanded,
  onToggle,
}: {
  quote: LifiSwapQuote;
  isQuoting: boolean;
  slippage: number;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const isCrossChain = quote.fromChainId !== quote.toChainId;
  return (
    <View className={cn({ 'opacity-50': isQuoting })}>
      <Pressable
        className="flex w-full flex-row items-center justify-between web:hover:opacity-70"
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
      >
        <View className="flex-row items-center gap-2">
          <Fuel strokeWidth={1} stroke="white" size={16} />
          <Text className="text-base font-semibold text-white/70">Total cost</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <TotalCost quote={quote} />
          {isCrossChain && (
            <Text className="text-sm text-white/50">
              · {formatEta(quote.executionDurationSeconds)}
            </Text>
          )}
          <View className={cn({ 'rotate-180': isExpanded })}>
            <ChevronDown strokeWidth={2} size={16} className="text-foreground" />
          </View>
        </View>
      </Pressable>
      {isExpanded && <Breakdown quote={quote} slippage={slippage} />}
    </View>
  );
};

const TotalCost = ({ quote }: { quote: LifiSwapQuote }) => {
  const total = lifiTotalCostUsd(quote);
  return (
    <Text className="text-base font-bold">{total === undefined ? '-' : formatUsd(total)}</Text>
  );
};

const Row = ({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) => (
  <View
    className={cn('flex flex-row items-center justify-between gap-4 p-4 md:p-6', {
      'border-b border-white/10': !last,
    })}
  >
    <Text className="text-base font-medium text-white/70">{label}</Text>
    <View className="flex-shrink items-end">{children}</View>
  </View>
);

const FeeValue = ({ fees }: { fees: LifiSwapFee[] }) => {
  // Fees on one line share a token in practice; show the token amount when
  // they do and fall back to dollars when they don't.
  const sameToken = fees.every(fee => fee.token.address === fees[0].token.address);
  const usdTotal = sumFeesUsd(fees);
  if (sameToken) {
    const raw = fees.reduce((total, fee) => total + BigInt(fee.amount), 0n);
    return (
      <View className="items-end">
        <Text className="text-base font-semibold">
          {tokenAmount(raw.toString(), fees[0].token.decimals)} {fees[0].token.symbol}
        </Text>
        <Text className="text-sm text-white/50">{formatUsd(usdTotal)}</Text>
      </View>
    );
  }
  return <Text className="text-base font-semibold">{formatUsd(usdTotal)}</Text>;
};

const Breakdown = ({ quote, slippage }: { quote: LifiSwapQuote; slippage: number }) => {
  const solidFees = quote.fees.filter(fee => fee.kind === 'solid');
  const lifiFees = quote.fees.filter(fee => fee.kind === 'lifi');
  const providerFees = quote.fees.filter(fee => fee.kind === 'provider' && fee.included);
  const onTopFees = quote.fees.filter(fee => !fee.included);

  const rate = useMemo(() => {
    const from = Number(formatUnits(BigInt(quote.fromAmount), quote.fromToken.decimals));
    const to = Number(formatUnits(BigInt(quote.toAmount), quote.toToken.decimals));
    return from > 0 ? to / from : 0;
  }, [quote]);

  const priceImpact = lifiPriceImpact(quote);
  const severity = priceImpact ? warningSeverity(priceImpact) : 0;
  const impactColor =
    severity >= 3 ? 'text-red-400' : severity === 2 ? 'text-yellow-400' : 'text-foreground';

  const isCrossChain = quote.fromChainId !== quote.toChainId;
  const solidPercent = (quote.solidFee.percentage * 100).toFixed(2);

  return (
    <View className="mt-6 flex flex-col rounded-xl bg-card">
      <Row label="Rate">
        <Text className="text-base font-semibold">
          1 {quote.fromToken.symbol} ≈ {formatNumber(rate, 6)} {quote.toToken.symbol}
        </Text>
      </Row>
      <Row label="Route">
        <RouteSteps quote={quote} />
      </Row>
      {isCrossChain && (
        <Row label="Estimated time">
          <Text className="text-base font-semibold">
            {formatEta(quote.executionDurationSeconds)}
          </Text>
        </Row>
      )}
      <Row label="Minimum received">
        <Text className="text-base font-semibold">
          {tokenAmount(quote.toAmountMin, quote.toToken.decimals)} {quote.toToken.symbol}
        </Text>
      </Row>
      <Row label={quote.solidFee.percentage > 0 ? `Solid fee (${solidPercent}%)` : 'Solid fee'}>
        {solidFees.length > 0 ? (
          <FeeValue fees={solidFees} />
        ) : (
          <Text className="text-base font-semibold">
            {(quote.solidFee.waiveReason && WAIVE_COPY[quote.solidFee.waiveReason]) || 'Free'}
          </Text>
        )}
      </Row>
      {lifiFees.length > 0 && (
        <Row label="LI.FI fee">
          <FeeValue fees={lifiFees} />
        </Row>
      )}
      {providerFees.length > 0 && (
        <Row label={isCrossChain ? 'Bridge & exchange fees' : 'Exchange fees'}>
          <FeeValue fees={providerFees} />
        </Row>
      )}
      {onTopFees.length > 0 && (
        <Row label={`Paid on top (${CHAIN_NAMES[quote.fromChainId] ?? 'source'} gas token)`}>
          <FeeValue fees={onTopFees} />
        </Row>
      )}
      {/* Our paymaster covers an operation only while its worst-case gas is
          under the policy's cap, so whether this one is covered isn't known
          until it is sent. Over the cap the app asks before the user pays
          (executeTransactions). No figure here: the cap is on the worst case,
          which a cheap-looking Ethereum swap can still pass. */}
      <Row label="Network fee">
        <View className="items-end">
          <Text className="text-base font-semibold text-green-400">Sponsored up to a limit</Text>
          <Text className="text-right text-sm text-white/50">
            Above it, we’ll ask before you pay
          </Text>
        </View>
      </Row>
      <Row label="Price impact">
        <Text className={cn('text-base font-semibold', impactColor)}>
          {priceImpact ? `${priceImpact.toFixed(2)}%` : '-'}
        </Text>
      </Row>
      <Row label="Slippage tolerance" last>
        <Text className="text-base font-semibold">{(slippage * 100).toFixed(2)}%</Text>
      </Row>
    </View>
  );
};

const RouteSteps = ({ quote }: { quote: LifiSwapQuote }) => (
  <View className="flex flex-row flex-wrap items-center justify-end gap-1">
    {quote.steps.map((step, idx) => (
      <Fragment key={`${step.tool}-${idx}`}>
        <Text className="text-sm font-semibold">{step.name}</Text>
        {idx === quote.steps.length - 1 ? null : <ChevronRight size={16} className="text-white" />}
      </Fragment>
    ))}
  </View>
);

export default LifiSwapParams;
