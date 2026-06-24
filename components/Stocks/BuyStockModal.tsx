import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import {
  ArrowRight,
  CheckCircle,
  ChevronRight,
  ExternalLink,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Text } from '@/components/ui/text';
import { useBalances } from '@/hooks/useBalances';
import { useCowOrder, useCowQuote } from '@/hooks/useCowSwap';
import { useXStocksTokens, XStockToken } from '@/hooks/useXStocksTokens';
import { atomsToShares, USDC_MAINNET, usdToUsdcAtoms } from '@/lib/cowswap';

type BuyStep = 'select' | 'input' | 'review' | 'pending';

const STEP_NUMBERS: Record<BuyStep, number> = { select: 1, input: 2, review: 3, pending: 4 };

const QUICK_AMOUNTS = [
  { label: '$10', value: '10' },
  { label: '$25', value: '25' },
  { label: '$50', value: '50' },
  { label: '$100', value: '100' },
];

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

type BuyStockModalProps = {
  isOpen: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
};

export default function BuyStockModal({ isOpen, onClose, trigger }: BuyStockModalProps) {
  const [step, setStep] = useState<BuyStep>('select');
  const [previousStep, setPreviousStep] = useState<BuyStep>('select');
  const [selectedToken, setSelectedToken] = useState<XStockToken | null>(null);
  const [amount, setAmount] = useState('50');

  const currentModal: ModalState = { name: step, number: STEP_NUMBERS[step] };
  const prevModal: ModalState = { name: previousStep, number: STEP_NUMBERS[previousStep] };

  const sellAmountAtoms = useMemo(() => usdToUsdcAtoms(amount), [amount]);

  const {
    quote,
    slippageBps,
    isLoading: quoteLoading,
    error: quoteError,
    countdown,
  } = useCowQuote({
    sellToken: USDC_MAINNET,
    buyToken: selectedToken?.contractAddress ?? '',
    sellAmountBeforeFee: sellAmountAtoms,
    kind: 'sell',
    enabled: isOpen && !!selectedToken && step !== 'select',
  });

  const cowOrder = useCowOrder('USDC', selectedToken?.symbol ?? '');

  const { ethereumTokens } = useBalances();
  const usdcBalance = useMemo(() => {
    const token = ethereumTokens.find(
      t => t.contractAddress.toLowerCase() === USDC_MAINNET.toLowerCase(),
    );
    return token ? Number(token.balance) / 1e6 : 0;
  }, [ethereumTokens]);

  const estimatedShares = useMemo(() => {
    if (quote) return atomsToShares(quote.quote.buyAmount).toFixed(3);
    return '—';
  }, [quote]);

  const minShares = useMemo(() => {
    if (!quote) return '—';
    const minAtoms = (BigInt(quote.quote.buyAmount) * BigInt(10_000 - slippageBps)) / 10_000n;
    return (Number(minAtoms) / 1e18).toFixed(4);
  }, [quote, slippageBps]);

  const effectivePrice = useMemo(() => {
    if (quote) {
      const shares = atomsToShares(quote.quote.buyAmount);
      return shares > 0 ? parseFloat(amount) / shares : 0;
    }
    return 0;
  }, [quote, amount]);

  function navigate(next: BuyStep) {
    setPreviousStep(step);
    setStep(next);
  }

  function handleClose() {
    setStep('select');
    setPreviousStep('select');
    setSelectedToken(null);
    setAmount('50');
    cowOrder.reset();
    onClose();
  }

  function handleOpenChange(open: boolean) {
    if (!open) handleClose();
  }

  function handleTokenSelect(token: XStockToken) {
    setSelectedToken(token);
    navigate('input');
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

  const stepTitle: Record<BuyStep, string | undefined> = {
    select: 'Buy stocks',
    input: selectedToken ? `Buy ${selectedToken.symbol}` : 'Buy',
    review: 'Review order',
    pending: undefined,
  };

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      currentModal={currentModal}
      previousModal={prevModal}
      trigger={trigger}
      title={stepTitle[step]}
      contentKey={step}
      showBackButton={step === 'input' || step === 'review'}
      onBackPress={() => navigate(step === 'input' ? 'select' : 'input')}
      hideHeader={step === 'pending'}
    >
      {step === 'select' && <SelectTokenStep onTokenSelect={handleTokenSelect} />}
      {step === 'input' && selectedToken && (
        <BuyInputStep
          token={selectedToken}
          amount={amount}
          onAmountChange={setAmount}
          estimatedShares={estimatedShares}
          effectivePrice={effectivePrice}
          quoteLoading={quoteLoading}
          quoteError={quoteError}
          countdown={countdown}
          usdcBalance={usdcBalance}
          onReview={() => navigate('review')}
        />
      )}
      {step === 'review' && selectedToken && (
        <BuyReviewStep
          token={selectedToken}
          amount={amount}
          estimatedShares={estimatedShares}
          minShares={minShares}
          effectivePrice={effectivePrice}
          slippageBps={slippageBps}
          isSubmitting={cowOrder.isSubmitting}
          orderError={cowOrder.error}
          onPlaceOrder={handlePlaceOrder}
        />
      )}
      {step === 'pending' && selectedToken && (
        <BuyPendingStep
          token={selectedToken}
          amount={amount}
          estimatedShares={estimatedShares}
          orderUid={cowOrder.orderUid}
          orderStatus={cowOrder.orderStatus}
          onDone={handleClose}
        />
      )}
    </ResponsiveModal>
  );
}

// ─── Select Token Step ────────────────────────────────────────────────────────

function SelectTokenStep({ onTokenSelect }: { onTokenSelect: (token: XStockToken) => void }) {
  const { tokens, isLoading, error } = useXStocksTokens();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return tokens;
    const q = search.toLowerCase();
    return tokens.filter(
      t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
    );
  }, [tokens, search]);

  return (
    <View className="pb-4" style={{ minHeight: 360 }}>
      <View className="mb-3 flex-row items-center gap-2 rounded-[12px] bg-[#1c1c1c] px-3 py-2.5">
        <Search size={16} color="#808080" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search stocks…"
          placeholderTextColor="#808080"
          style={
            {
              flex: 1,
              color: 'white',
              fontSize: 14,
              outlineWidth: 0,
              borderWidth: 0,
              boxShadow: 'none',
            } as any
          }
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading && (
        <View className="items-center justify-center py-12">
          <ActivityIndicator color="#94f27f" />
          <Text className="mt-3 text-sm text-[#808080]">Loading stocks…</Text>
        </View>
      )}

      {!!error && (
        <View className="items-center py-8">
          <Text className="text-sm text-red-400">{error}</Text>
        </View>
      )}

      {!isLoading && !error && (
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          {filtered.map(token => (
            <Pressable
              key={token.contractAddress}
              onPress={() => onTokenSelect(token)}
              className="flex-row items-center gap-3 rounded-[12px] px-2 py-3 active:bg-[#1c1c1c]"
            >
              <Image
                source={{ uri: token.logoUrl }}
                style={{ width: 36, height: 36, borderRadius: 18 }}
                contentFit="contain"
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-white">{token.symbol}</Text>
                <Text className="text-xs text-[#808080]" numberOfLines={1}>
                  {token.name}
                </Text>
              </View>
              <ChevronRight size={16} color="#808080" />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Input Step ───────────────────────────────────────────────────────────────

function BuyInputStep({
  token,
  amount,
  onAmountChange,
  estimatedShares,
  effectivePrice,
  quoteLoading,
  quoteError,
  countdown,
  usdcBalance,
  onReview,
}: {
  token: XStockToken;
  amount: string;
  onAmountChange: (v: string) => void;
  estimatedShares: string;
  effectivePrice: number;
  quoteLoading: boolean;
  quoteError: string | null;
  countdown: number;
  usdcBalance: number;
  onReview: () => void;
}) {
  const inputRef = React.useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const parsedAmount = parseFloat(amount) || 0;
  const insufficientBalance = usdcBalance > 0 && parsedAmount > usdcBalance;
  const canReview =
    !!amount &&
    parsedAmount > 0 &&
    !insufficientBalance &&
    estimatedShares !== '—' &&
    !quoteLoading &&
    !quoteError;

  return (
    <View className="gap-8 pb-4">
      <View className="items-center gap-8">
        {/* Token header */}
        <View className="flex-row items-center gap-2">
          <Image
            source={{ uri: token.logoUrl }}
            style={{ width: 28, height: 28, borderRadius: 14 }}
            contentFit="contain"
          />
          <Text className="text-sm font-medium text-[#808080]">{token.name}</Text>
        </View>

        {/* Amount display — visible Text + invisible TextInput avoids browser input chrome */}
        <View className="items-center gap-2">
          <View style={{ position: 'relative' }}>
            <Pressable
              onPress={() => inputRef.current?.focus()}
              className="flex-row items-center justify-center"
            >
              <Text style={{ fontSize: 48, fontWeight: 'bold', color: 'white', lineHeight: 56 }}>
                $
              </Text>
              <Text
                style={{
                  fontSize: 48,
                  fontWeight: 'bold',
                  color: 'white',
                  lineHeight: 56,
                }}
              >
                {amount || '0'}
              </Text>
              {isFocused && (
                <View
                  style={{ width: 2.5, height: 50, backgroundColor: '#94f27f', marginLeft: 2 }}
                />
              )}
            </Pressable>
            {/* Invisible input — captures keyboard, never renders browser chrome */}
            <TextInput
              ref={inputRef}
              value={amount}
              onChangeText={text => {
                const cleaned = text.replace(/[^0-9.]/g, '');
                const parts = cleaned.split('.');
                const sanitized =
                  parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
                const normalized = sanitized.replace(/^0+(\d)/, '$1');
                onAmountChange(normalized || '');
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              keyboardType="decimal-pad"
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1, top: 0, left: 0 }}
            />
          </View>
          <Text className="text-sm text-[#808080]">
            ≈ {estimatedShares} {token.symbol}
          </Text>
          {usdcBalance > 0 && (
            <Pressable
              onPress={() => onAmountChange((Math.floor(usdcBalance * 100) / 100).toFixed(2))}
            >
              <Text
                className={`text-xs ${insufficientBalance ? 'text-red-400' : 'text-[#808080]'}`}
              >
                Balance: ${(Math.floor(usdcBalance * 100) / 100).toFixed(2)} USDC
                {insufficientBalance ? ' — tap to use max' : ''}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Quick amounts */}
        <View className="flex-row gap-2">
          {QUICK_AMOUNTS.map(qa => (
            <Pressable
              key={qa.label}
              onPress={() => onAmountChange(qa.value)}
              className={`rounded-[8px] px-4 py-2 active:opacity-70 ${amount === qa.value ? 'bg-[#94f27f]' : 'bg-[#1c1c1c]'}`}
            >
              <Text
                className={`text-xs font-semibold ${amount === qa.value ? 'text-black' : 'text-white'}`}
              >
                {qa.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Pay with USDC row */}
      <View className="flex-row items-center gap-3 rounded-[16px] bg-[#1c1c1c] p-4">
        <Image
          source={{
            uri: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
          }}
          style={{ width: 32, height: 32, borderRadius: 16 }}
          contentFit="contain"
        />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-white">USDC</Text>
          <Text className="text-xs text-[#808080]">Pay with USDC on Ethereum</Text>
        </View>
      </View>

      {/* Quote card */}
      <View className="gap-3 rounded-[16px] bg-[#1c1c1c] p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-[#808080]">Price per share</Text>
          {quoteLoading ? (
            <ActivityIndicator size="small" color="#94f27f" />
          ) : (
            <Text className="text-sm font-medium text-white">
              {effectivePrice > 0 ? `$${effectivePrice.toFixed(2)}` : '—'}
            </Text>
          )}
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-[#808080]">Est. received</Text>
          {quoteLoading ? (
            <ActivityIndicator size="small" color="#94f27f" />
          ) : (
            <Text className="text-sm font-medium text-white">
              {estimatedShares} {token.symbol}
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2 rounded-[8px] border border-[#94f27f] px-3 py-2">
          <ShieldCheck size={14} color="#94f27f" />
          <Text className="text-xs font-medium text-[#94f27f]">No gas fees · MEV protected</Text>
        </View>
        {quoteError ? (
          <Text className="text-center text-xs text-red-400">{quoteError}</Text>
        ) : (
          <View className="flex-row items-center justify-center gap-1 pt-2">
            <RefreshCw size={12} color="#808080" />
            <Text className="text-xs text-[#808080]">
              {quoteLoading ? 'Fetching quote…' : `Refreshing in ${countdown}s`}
            </Text>
          </View>
        )}
      </View>

      {/* CTA */}
      <Pressable
        onPress={onReview}
        disabled={!canReview}
        className={`items-center justify-center rounded-[16px] py-4 active:opacity-80 ${canReview ? 'bg-[#94f27f]' : 'bg-[#2a2a2a]'}`}
      >
        <Text className={`text-lg font-semibold ${canReview ? 'text-black' : 'text-[#808080]'}`}>
          {quoteLoading ? 'Getting quote…' : 'Review order'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Review Step ──────────────────────────────────────────────────────────────

function BuyReviewStep({
  token,
  amount,
  estimatedShares,
  minShares,
  effectivePrice,
  slippageBps,
  isSubmitting,
  orderError,
  onPlaceOrder,
}: {
  token: XStockToken;
  amount: string;
  estimatedShares: string;
  minShares: string;
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
            <Text className="text-sm text-[#808080]">Pay</Text>
            <View className="flex-row items-baseline gap-1">
              <Text className="text-2xl font-semibold text-white">${amount}.00</Text>
              <Text className="text-sm text-[#808080]">USDC</Text>
            </View>
          </View>
          <ArrowRight size={24} color="white" />
          <View className="items-end gap-1">
            <Text className="text-sm text-[#808080]">Receive</Text>
            <View className="flex-row items-baseline gap-1">
              <Text className="text-2xl font-semibold text-white">≈ {estimatedShares}</Text>
              <Text className="text-sm text-[#808080]">{token.symbol}</Text>
            </View>
          </View>
        </View>

        <View className="h-px bg-white/10" />

        <View className="gap-3">
          {[
            { label: 'Effective price', value: `$${effectivePrice.toFixed(2)}/share` },
            { label: 'Shares received', value: `${estimatedShares} ${token.symbol}` },
            {
              label: 'Minimum received',
              value: `${minShares} ${token.symbol}`,
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
          Tokenized stock, 1:1 backed by {token.name} shares held by Backed Finance.
        </Text>
      </View>

      {!!orderError && (
        <View className="rounded-[12px] border border-red-500/50 bg-red-900/30 px-4 py-3">
          <Text className="text-sm text-red-400">{orderError}</Text>
        </View>
      )}

      {/* Place order */}
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

function BuyPendingStep({
  token,
  amount,
  estimatedShares,
  orderUid,
  orderStatus,
  onDone,
}: {
  token: XStockToken;
  amount: string;
  estimatedShares: string;
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
              ? `You received ${estimatedShares} ${token.symbol}.`
              : `Your $${amount} buy of ${token.symbol} is being matched by CoW solvers.`}
          </Text>
        </View>
      </View>

      {/* Details card */}
      <View className="mt-3 gap-3 rounded-[16px] bg-[#1c1c1c] p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-[#808080]">Order</Text>
          <Text className="text-sm font-medium text-white">
            ${amount} → {estimatedShares} {token.symbol}
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
        className="mt-3 items-center justify-center rounded-[16px] bg-[#2a2a2a] py-3 active:opacity-80"
      >
        <Text className="text-base font-semibold text-white">Done</Text>
      </Pressable>
    </Animated.View>
  );
}
