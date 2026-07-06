import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import {
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Info,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Text } from '@/components/ui/text';
import { useCowOrder, useCowQuote } from '@/hooks/useCowSwap';
import { sharesToAtoms, USDC_MAINNET, usdcAtomsToUsd } from '@/lib/cowswap';

import { Holding } from './stocksData';

type SellStep = 'input' | 'review' | 'pending';

const STEP_NUMBERS: Record<SellStep, number> = { input: 1, review: 2, pending: 3 };

const STATUS_LABEL: Record<string, string> = {
  presignaturePending: 'Confirming on-chain…',
  open: 'Pending — awaiting solver',
  fulfilled: 'Filled',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const STATUS_COLOR: Record<string, string> = {
  presignaturePending: '#ffd60a',
  open: '#ffd60a',
  fulfilled: '#94f27f',
  cancelled: '#ff6b6b',
  expired: '#808080',
};

type SellStockModalProps = {
  holding: Holding | null;
  stockPrice: number;
  isOpen: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
};

export default function SellStockModal({
  holding,
  stockPrice,
  isOpen,
  onClose,
  trigger,
}: SellStockModalProps) {
  const [step, setStep] = useState<SellStep>('input');
  const [previousStep, setPreviousStep] = useState<SellStep>('input');
  const [unit, setUnit] = useState<'shares' | 'usd'>('shares');
  // fraction of total holding to sell (0–1)
  const [fraction, setFraction] = useState(1);

  const currentModal: ModalState = { name: step, number: STEP_NUMBERS[step] };
  const prevModal: ModalState = { name: previousStep, number: STEP_NUMBERS[previousStep] };

  const sharesAmount = holding ? holding.shares * fraction : 0;
  const sellAmountAtoms = useMemo(() => sharesToAtoms(sharesAmount), [sharesAmount]);

  const {
    quote,
    slippageBps,
    isLoading: quoteLoading,
    error: quoteError,
    countdown,
  } = useCowQuote({
    sellToken: holding?.contractAddress ?? '',
    buyToken: USDC_MAINNET,
    sellAmountBeforeFee: sellAmountAtoms,
    kind: 'sell',
    enabled: isOpen && !!holding?.contractAddress && sharesAmount > 0,
  });

  const cowOrder = useCowOrder(holding?.ticker ?? '', 'USDC');

  const estimatedUsdc = useMemo(() => {
    if (quote) return usdcAtomsToUsd(quote.quote.buyAmount);
    return Math.max(0, sharesAmount * stockPrice - 0.49);
  }, [quote, sharesAmount, stockPrice]);

  const minUsdc = useMemo(() => {
    if (!quote) return 0;
    const minAtoms = (BigInt(quote.quote.buyAmount) * BigInt(10_000 - slippageBps)) / 10_000n;
    return Number(minAtoms) / 1e6;
  }, [quote, slippageBps]);

  const effectivePrice = useMemo(() => {
    if (quote) {
      const usdc = usdcAtomsToUsd(quote.quote.buyAmount);
      return sharesAmount > 0 ? usdc / sharesAmount : stockPrice;
    }
    return stockPrice * 0.998;
  }, [quote, sharesAmount, stockPrice]);

  const usdAmount = sharesAmount * stockPrice;
  const returnPct = holding ? ((stockPrice - holding.avgCost) / holding.avgCost) * 100 : 0;
  const returnAbs = holding ? (stockPrice - holding.avgCost) * sharesAmount : 0;

  function navigate(next: SellStep) {
    setPreviousStep(step);
    setStep(next);
  }

  function handleClose() {
    setStep('input');
    setPreviousStep('input');
    setFraction(1);
    cowOrder.reset();
    onClose();
  }

  function handleOpenChange(open: boolean) {
    if (!open) handleClose();
  }

  async function handlePlaceOrder() {
    if (!quote) return;
    try {
      await cowOrder.placeOrder(quote, slippageBps);
      navigate('pending');
    } catch {
      // error is stored in cowOrder.error and displayed in the review step
    }
  }

  if (!holding) return <>{trigger}</>;

  const titles: Record<SellStep, string> = {
    input: `Sell ${holding.ticker}`,
    review: 'Review order',
    pending: '',
  };

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      currentModal={currentModal}
      previousModal={prevModal}
      trigger={trigger}
      title={step !== 'pending' ? titles[step] : undefined}
      contentKey={step}
      showBackButton={step === 'review'}
      onBackPress={() => navigate('input')}
      hideHeader={step === 'pending'}
    >
      {step === 'input' && (
        <SellInputStep
          holding={holding}
          stockPrice={stockPrice}
          unit={unit}
          onUnitChange={setUnit}
          fraction={fraction}
          onFractionChange={setFraction}
          sharesAmount={sharesAmount}
          usdAmount={usdAmount}
          estimatedUsdc={estimatedUsdc}
          returnPct={returnPct}
          returnAbs={returnAbs}
          quoteLoading={quoteLoading}
          quoteError={quoteError}
          countdown={countdown}
          onReview={() => navigate('review')}
          onClose={handleClose}
        />
      )}
      {step === 'review' && (
        <SellReviewStep
          holding={holding}
          sharesAmount={sharesAmount}
          estimatedUsdc={estimatedUsdc}
          minUsdc={minUsdc}
          effectivePrice={effectivePrice}
          slippageBps={slippageBps}
          isSubmitting={cowOrder.isSubmitting}
          orderError={cowOrder.error}
          onPlaceOrder={handlePlaceOrder}
        />
      )}
      {step === 'pending' && (
        <SellPendingStep
          holding={holding}
          sharesAmount={sharesAmount}
          estimatedUsdc={estimatedUsdc}
          orderUid={cowOrder.orderUid}
          orderStatus={cowOrder.orderStatus}
          onDone={handleClose}
        />
      )}
    </ResponsiveModal>
  );
}

// ─── Input Step ───────────────────────────────────────────────────────────────

const QUICK_FRACTIONS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: 'Max', value: 1 },
];

function SellInputStep({
  holding,
  stockPrice,
  unit,
  onUnitChange,
  fraction,
  onFractionChange,
  sharesAmount,
  usdAmount,
  estimatedUsdc,
  returnPct,
  returnAbs,
  quoteLoading,
  quoteError,
  countdown,
  onReview,
}: {
  holding: Holding;
  stockPrice: number;
  unit: 'shares' | 'usd';
  onUnitChange: (u: 'shares' | 'usd') => void;
  fraction: number;
  onFractionChange: (f: number) => void;
  sharesAmount: number;
  usdAmount: number;
  estimatedUsdc: number;
  returnPct: number;
  returnAbs: number;
  quoteLoading: boolean;
  quoteError: string | null;
  countdown: number;
  onReview: () => void;
  onClose: () => void;
}) {
  const isPositiveReturn = returnPct >= 0;
  const hasContract = !!holding.contractAddress;

  return (
    <View className="gap-8 pb-4">
      <View className="items-center gap-8">
        {/* Shares / USD toggle */}
        <View className="flex-row gap-1 rounded-[12px] bg-[#1c1c1c] p-1">
          {(['shares', 'usd'] as const).map(u => (
            <Pressable
              key={u}
              onPress={() => onUnitChange(u)}
              className={`rounded-[8px] px-6 py-2 active:opacity-70 ${unit === u ? 'bg-[#2a2a2a]' : ''}`}
            >
              <Text
                className={`text-sm font-semibold ${unit === u ? 'text-white' : 'text-[#808080]'}`}
              >
                {u === 'shares' ? 'Shares' : 'USD'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Amount display */}
        <View className="items-center gap-2">
          <View className="flex-row items-center gap-0.5">
            <Text className="text-[48px] font-bold leading-tight text-white">
              {unit === 'shares' ? sharesAmount.toFixed(2) : `$${usdAmount.toFixed(2)}`}
            </Text>
            <View className="h-10 w-0.5 bg-[#94f27f]" />
          </View>
          <Text className="text-sm text-[#808080]">
            {unit === 'shares'
              ? `≈ $${usdAmount.toFixed(2)} USD`
              : `≈ ${sharesAmount.toFixed(2)} ${holding.ticker}`}
          </Text>
        </View>

        {/* Quick fractions */}
        <View className="flex-row gap-2">
          {QUICK_FRACTIONS.map(qf => (
            <Pressable
              key={qf.label}
              onPress={() => onFractionChange(qf.value)}
              className={`rounded-[8px] px-4 py-2 active:opacity-70 ${fraction === qf.value ? 'bg-[#94f27f]' : 'bg-[#1c1c1c]'}`}
            >
              <Text
                className={`text-xs font-semibold ${fraction === qf.value ? 'text-black' : 'text-white'}`}
              >
                {qf.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Receive USDC row */}
      <View className="flex-row items-center gap-3 rounded-[16px] bg-[#1c1c1c] p-4">
        <Image
          source={{
            uri: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
          }}
          style={{ width: 32, height: 32, borderRadius: 16 }}
          contentFit="contain"
        />
        <Text className="flex-1 text-base font-medium text-white">USDC</Text>
        {quoteLoading ? (
          <ActivityIndicator size="small" color="#94f27f" />
        ) : (
          <Text className="text-base font-medium text-white">${estimatedUsdc.toFixed(2)} est.</Text>
        )}
      </View>

      {/* Quote card */}
      <View className="gap-3 rounded-[16px] bg-[#1c1c1c] p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-[#808080]">Price per share</Text>
          <Text className="text-sm font-semibold text-white">
            $
            {stockPrice.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-[#808080]">Estimated USDC</Text>
          {quoteLoading ? (
            <ActivityIndicator size="small" color="#94f27f" />
          ) : (
            <Text className="text-sm font-semibold text-white">${estimatedUsdc.toFixed(2)}</Text>
          )}
        </View>
        <View className="flex-row items-center gap-2 rounded-[8px] border border-[#94f27f] px-3 py-2">
          <ShieldCheck size={14} color="#94f27f" />
          <Text className="text-xs font-medium text-white">No gas fees · MEV protected</Text>
        </View>
        {quoteError ? (
          <Text className="text-center text-xs text-red-400">{quoteError}</Text>
        ) : (
          <View className="flex-row items-center justify-center gap-1">
            <RefreshCw size={12} color="#808080" />
            <Text className="text-xs text-[#808080]">
              {quoteLoading ? 'Fetching quote…' : `Refreshing in ${countdown}s`}
            </Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <Text className="text-center text-xs text-[#808080]">
        {holding.shares.toFixed(2)} {holding.ticker} available · Avg cost $
        {holding.avgCost.toFixed(2)} · Est. return {isPositiveReturn ? '+' : ''}$
        {returnAbs.toFixed(2)} ({isPositiveReturn ? '+' : ''}
        {returnPct.toFixed(2)}%)
      </Text>

      {/* CTA */}
      <Pressable
        onPress={onReview}
        disabled={!hasContract}
        className={`items-center justify-center rounded-[16px] py-4 active:opacity-80 ${hasContract ? 'bg-[#94f27f]' : 'bg-[#2a2a2a]'}`}
      >
        <Text
          className={`text-base font-semibold ${hasContract ? 'text-black' : 'text-[#808080]'}`}
        >
          {hasContract ? 'Review order' : 'Coming soon'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Review Step ──────────────────────────────────────────────────────────────

function SellReviewStep({
  holding,
  sharesAmount,
  estimatedUsdc,
  minUsdc,
  effectivePrice,
  slippageBps,
  isSubmitting,
  orderError,
  onPlaceOrder,
}: {
  holding: Holding;
  sharesAmount: number;
  estimatedUsdc: number;
  minUsdc: number;
  effectivePrice: number;
  slippageBps: number;
  isSubmitting: boolean;
  orderError: string | null;
  onPlaceOrder: () => void;
}) {
  return (
    <View className="gap-6 pb-4">
      {/* Summary card */}
      <View className="gap-5 rounded-[20px] bg-[#1c1c1c] p-6">
        <View className="flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-sm text-[#808080]">Sell</Text>
            <View className="flex-row items-baseline gap-1">
              <Text className="text-2xl font-semibold text-white">{sharesAmount.toFixed(3)}</Text>
              <Text className="text-sm text-[#808080]">{holding.ticker}</Text>
            </View>
          </View>
          <ArrowRight size={24} color="white" />
          <View className="items-end gap-1">
            <Text className="text-sm text-[#808080]">Receive</Text>
            <View className="flex-row items-baseline gap-1">
              <Text className="text-2xl font-semibold text-white">
                ≈ ${estimatedUsdc.toFixed(2)}
              </Text>
              <Text className="text-sm text-[#808080]">USDC</Text>
            </View>
          </View>
        </View>

        <View className="h-px bg-white/10" />

        <View className="gap-3">
          {[
            { label: 'Effective price', value: `$${effectivePrice.toFixed(2)}/share` },
            { label: 'USDC received', value: `$${estimatedUsdc.toFixed(2)}` },
            {
              label: 'Minimum received',
              value: `$${minUsdc.toFixed(2)} USDC`,
              valueColor: '#808080',
            },
            {
              label: 'Slippage (dynamic)',
              value: `${(slippageBps / 100).toFixed(2)}%`,
              valueColor: '#ffd60a',
            },
            { label: 'Gas fees', value: 'None', valueColor: '#94f27f' },
            { label: 'Validity', value: 'Valid for 10:00' },
          ].map(row => (
            <View key={row.label} className="flex-row items-center justify-between">
              <Text className="text-sm text-[#808080]">{row.label}</Text>
              <Text className="text-sm font-semibold" style={{ color: row.valueColor ?? 'white' }}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Trust badges */}
      <View className="mt-3 flex-row flex-wrap gap-2">
        {['No gas fees', 'MEV protected', 'Self-custodied'].map(badge => (
          <View key={badge} className="rounded-[20px] border border-[#94f27f] px-2 py-1">
            <Text className="text-xs font-medium text-[#94f27f]">{badge}</Text>
          </View>
        ))}
      </View>

      {/* Info note */}
      <View className="flex-row gap-3 rounded-[16px] border border-[#ffd60a] bg-[#3b2e15] p-4">
        <Info size={18} color="#ffd60a" />
        <Text className="flex-1 text-sm leading-5 text-[#ffd60a]">
          You are selling tokenized stock. Proceeds will be deposited as USDC to your wallet.
        </Text>
      </View>

      {orderError && (
        <View className="rounded-[12px] border border-red-500/50 bg-red-900/30 px-4 py-3">
          <Text className="text-sm text-red-400">{orderError}</Text>
        </View>
      )}

      <View className="gap-4">
        <Pressable
          onPress={onPlaceOrder}
          disabled={isSubmitting}
          className="items-center justify-center rounded-[16px] bg-[#94f27f] py-4 active:opacity-80"
        >
          {isSubmitting ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text className="text-base font-semibold text-black">Place order</Text>
          )}
        </Pressable>
        <Text className="text-center text-xs text-[#808080]">
          Signing is off-chain — no gas required.
        </Text>
      </View>
    </View>
  );
}

// ─── Pending Step ─────────────────────────────────────────────────────────────

function SellPendingStep({
  holding,
  sharesAmount,
  estimatedUsdc,
  orderUid,
  orderStatus,
  onDone,
}: {
  holding: Holding;
  sharesAmount: number;
  estimatedUsdc: number;
  orderUid: string | null;
  orderStatus: string | null;
  onDone: () => void;
}) {
  const isFilled = orderStatus === 'fulfilled';
  const statusLabel = orderStatus ? (STATUS_LABEL[orderStatus] ?? orderStatus) : 'Pending…';
  const statusColor = orderStatus ? (STATUS_COLOR[orderStatus] ?? '#ffd60a') : '#ffd60a';
  const explorerUrl = orderUid ? `https://explorer.cow.fi/orders/${orderUid}` : null;

  return (
    <Animated.View entering={FadeIn.duration(300)} className="gap-8 py-6">
      {/* Icon + title */}
      <View className="items-center gap-5">
        <View className="size-20 items-center justify-center rounded-full bg-[#1c1c1c]">
          {isFilled ? (
            <CheckCircle size={40} color="#94f27f" />
          ) : (
            <ActivityIndicator size="large" color="#94f27f" />
          )}
        </View>
        <View className="items-center gap-2">
          <Text className="text-2xl font-semibold text-white">
            {isFilled ? 'Order filled!' : 'Order placed'}
          </Text>
          <Text className="max-w-[280px] text-center text-sm leading-5 text-[#808080]">
            {isFilled
              ? `You received $${estimatedUsdc.toFixed(2)} USDC.`
              : `Your ${sharesAmount.toFixed(3)} ${holding.ticker} sell is being matched by CoW solvers.`}
          </Text>
        </View>
      </View>

      {/* Details card */}
      <View className="mt-3 gap-3 rounded-[16px] bg-[#1c1c1c] p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-[#808080]">Order</Text>
          <Text className="text-sm font-medium text-white">
            {sharesAmount.toFixed(3)} {holding.ticker} → ${estimatedUsdc.toFixed(2)} USDC
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-[#808080]">Status</Text>
          <View className="flex-row items-center gap-1.5">
            <View className="size-2 rounded-full" style={{ backgroundColor: statusColor }} />
            <Text className="text-sm font-medium" style={{ color: statusColor }}>
              {statusLabel}
            </Text>
          </View>
        </View>
        {!!explorerUrl && (
          <>
            <View className="h-px bg-white/10" />
            <Pressable
              onPress={() => Linking.openURL(explorerUrl)}
              className="flex-row items-center justify-between active:opacity-70"
            >
              <Text className="text-sm text-[#808080]">CoW Explorer</Text>
              <View className="flex-row items-center gap-1">
                <Text className="text-sm font-medium text-[#94f27f]">
                  {orderUid!.slice(2, 10)}…{orderUid!.slice(-6)}
                </Text>
                <ExternalLink size={13} color="#94f27f" />
              </View>
            </Pressable>
          </>
        )}
      </View>

      {/* Badges */}
      <View className="mt-3 flex-row justify-center gap-2">
        {['No gas fees', 'MEV protected', 'Self-custodied'].map(b => (
          <View key={b} className="rounded-[20px] border border-[#94f27f]/30 px-2.5 py-1">
            <Text className="text-xs font-medium text-[#94f27f]">{b}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onDone}
        className="mt-3 items-center justify-center rounded-[16px] bg-[#2a2a2a] py-4 active:opacity-80"
      >
        <Text className="text-base font-semibold text-white">Done</Text>
      </Pressable>
    </Animated.View>
  );
}
