import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';

import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useWalletTopUpNavigation } from '@/components/WalletTopUp/WalletTopUpNavigation';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCreateWalletTopUpQuote } from '@/hooks/useWalletTopUp';
import { useWalletTopUpAvailability } from '@/hooks/useWalletTopUpAvailability';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { CURRENCY_SYMBOLS } from '@/lib/utils/cardHelpers';
import {
  checkWalletTopUpAmount,
  formatWalletTopUpMoney,
  getWalletTopUpPlatform,
  getWalletTopUpQuoteErrorMessage,
  getWalletTopUpToken,
  sanitizeWalletTopUpAmount,
  toWalletTopUpWireAmount,
  WALLET_TOPUP_METHOD_LABEL,
} from '@/lib/walletTopUp';
import { useWalletTopUpStore } from '@/store/useWalletTopUpStore';

const TOKEN_ICONS = {
  USDC: getAsset('images/usdc-4x.png'),
  EURC: getAsset('images/eurc.png'),
};

const CURRENCY_NAMES = { USD: 'US dollars', EUR: 'euros' };

/**
 * First step of the Apple Pay / Google Pay top-up: how much the user gets.
 *
 * The amount is what lands in the wallet — USDC for dollars, EURC for euros —
 * and the price in the user's card currency comes back with the quote, which
 * Wirex's checkout shows on the next step. Continue fetches that quote, so the
 * button is held until the amount is inside the backend's limits for the
 * currency.
 */
export const WalletTopUpAmount = () => {
  const navigate = useWalletTopUpNavigation();
  const { availability, isLoading } = useWalletTopUpAvailability();

  const method = useWalletTopUpStore(state => state.method);
  const source = useWalletTopUpStore(state => state.source);
  const amount = useWalletTopUpStore(state => state.amount);
  const currency = useWalletTopUpStore(state => state.currency);
  const setAmount = useWalletTopUpStore(state => state.setAmount);
  const setCurrency = useWalletTopUpStore(state => state.setCurrency);
  const setQuote = useWalletTopUpStore(state => state.setQuote);

  const { mutate: createQuote, isPending: isQuoting } = useCreateWalletTopUpQuote();
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const currencies = availability?.currencies ?? [];
  // The backend's default is the user's card currency, until they pick another.
  const activeCurrency =
    availability && currency && availability.currencies.includes(currency)
      ? currency
      : availability?.defaultCurrency;

  // Kept in the store, where the review step re-prices with it.
  useEffect(() => {
    if (activeCurrency && activeCurrency !== currency) setCurrency(activeCurrency);
  }, [activeCurrency, currency, setCurrency]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator size="large" color="#94F27F" />
      </View>
    );
  }

  const label = WALLET_TOPUP_METHOD_LABEL[method];

  // The row is only shown to a user the backend offers this to, but the answer
  // can change while the sheet is open (the cohort, Wirex's capability).
  if (!availability || !activeCurrency) {
    return (
      <View className="gap-6 py-6">
        <Text className="text-center text-base text-muted-foreground">
          {label} top-ups aren&apos;t available right now.
        </Text>
        <Button
          className="h-12 rounded-full"
          variant="secondary"
          onPress={() => navigate(DEPOSIT_MODAL.CLOSE)}
        >
          <Text className="text-base font-semibold text-white">Close</Text>
        </Button>
      </View>
    );
  }

  const token = getWalletTopUpToken(availability, activeCurrency);
  const limit = availability.limits[activeCurrency];
  const check = checkWalletTopUpAmount(amount, limit);
  const isOutOfLimits = check === 'below_min' || check === 'above_max';
  const canSwitchCurrency = currencies.length > 1;
  const continueDisabled = check !== 'ok' || isQuoting;

  const handleAmountChange = (text: string) => {
    setQuoteError(null);
    setAmount(sanitizeWalletTopUpAmount(text));
  };

  const handleSwitchCurrency = () => {
    const next = currencies[(currencies.indexOf(activeCurrency) + 1) % currencies.length];
    setQuoteError(null);
    setCurrency(next);
  };

  const handleContinue = () => {
    if (check !== 'ok') return;
    const wireAmount = toWalletTopUpWireAmount(amount);
    const analytics = {
      amount: Number(wireAmount),
      currency: activeCurrency,
      payment_method: method,
      source,
    };
    track(TRACKING_EVENTS.WALLET_TOPUP_AMOUNT_SUBMITTED, analytics);
    setCurrency(activeCurrency);

    createQuote(
      {
        amount: wireAmount,
        currency: activeCurrency,
        paymentMethod: method,
        platform: getWalletTopUpPlatform(Platform.OS),
      },
      {
        onSuccess: quote => {
          setQuote(quote);
          navigate(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_REVIEW);
        },
        onError: error => {
          const status = (error as { status?: number }).status;
          track(TRACKING_EVENTS.WALLET_TOPUP_QUOTE_FAILED, {
            ...analytics,
            during: 'amount',
            status,
            code: (error as { code?: string }).code,
          });
          setQuoteError(getWalletTopUpQuoteErrorMessage(error, method));
        },
      },
    );
  };

  return (
    <View className="shrink-0 gap-6">
      <View className="gap-2.5">
        <Text className="text-base font-medium text-white/70">You get</Text>
        <View className="h-[80px] flex-row items-center justify-between rounded-[15px] bg-[#1C1C1C] pl-4 pr-3.5">
          <View className="mr-3 flex-1 flex-row items-center">
            <Text className="text-3xl font-semibold text-white/50">
              {CURRENCY_SYMBOLS[activeCurrency]}
            </Text>
            <TextInput
              accessibilityLabel={`Amount in ${CURRENCY_NAMES[activeCurrency]}`}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.5)"
              className="flex-1 p-0 text-3xl font-semibold text-white web:outline-none"
              style={{ fontFamily: 'MonaSans_600SemiBold' }}
            />
          </View>
          <Pressable
            accessibilityRole={canSwitchCurrency ? 'button' : undefined}
            accessibilityLabel={canSwitchCurrency ? `Get ${token}. Change currency` : undefined}
            disabled={!canSwitchCurrency}
            onPress={handleSwitchCurrency}
            className="h-12 shrink-0 flex-row items-center gap-[7px] rounded-full bg-white/10 px-3 active:opacity-80"
          >
            <Image
              source={TOKEN_ICONS[token]}
              style={{ width: 24, height: 24 }}
              contentFit="contain"
            />
            <Text className="text-lg font-semibold text-white">{token}</Text>
            {canSwitchCurrency ? <ChevronDown size={18} color="#FFFFFF" /> : null}
          </Pressable>
        </View>
        {limit ? (
          <Text className="text-xs font-medium leading-[18px] text-white/50">
            Between {formatWalletTopUpMoney(limit.min, activeCurrency)} and{' '}
            {formatWalletTopUpMoney(limit.max, activeCurrency)} per top-up
          </Text>
        ) : null}
        {check === 'below_min' && limit ? (
          <Text className="text-xs text-red-500">
            Enter at least {formatWalletTopUpMoney(limit.min, activeCurrency)}.
          </Text>
        ) : null}
        {check === 'above_max' && limit ? (
          <Text className="text-xs text-red-500">
            Enter at most {formatWalletTopUpMoney(limit.max, activeCurrency)}.
          </Text>
        ) : null}
        {quoteError ? <Text className="text-xs text-red-500">{quoteError}</Text> : null}
      </View>

      <View className="gap-2 rounded-[15px] bg-[#1C1C1C] p-4">
        <Text className="text-base font-semibold leading-[22px] text-white">
          Lands in your Solid wallet
        </Text>
        <Text className="text-sm font-medium leading-5 text-white/70">
          Paid as {token} on Base, so your card can spend it right away.
        </Text>
      </View>

      <View className="gap-[18px]">
        <Button
          className={`h-12 rounded-full ${continueDisabled ? 'bg-white/20 active:scale-100 active:opacity-100 web:hover:bg-white/20' : ''}`}
          variant="brand"
          onPress={handleContinue}
          disabled={continueDisabled}
        >
          <Text
            className={
              continueDisabled ? 'text-base font-bold text-white' : 'text-base font-bold text-black'
            }
          >
            {isQuoting
              ? 'Getting your price…'
              : isOutOfLimits
                ? 'Amount out of limits'
                : 'Continue'}
          </Text>
        </Button>

        <NeedHelp />
      </View>
    </View>
  );
};

export default WalletTopUpAmount;
