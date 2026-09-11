import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';

import { useBuyCryptoNavigation } from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';
import { CardFundChip } from '@/components/Card/CardFund/CardFundRow';
import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useOnramperAssets, useOnramperConfig } from '@/hooks/useOnramper';
import useOnramperAvailability from '@/hooks/useOnramperAvailability';
import useOnramperCheckout from '@/hooks/useOnramperCheckout';
import useOnramperClient from '@/hooks/useOnramperClient';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { isDevFeatureEnabled } from '@/lib/config';
import { signOutOnramper } from '@/lib/onramper';
import { describeOnramperError } from '@/lib/onramperErrors';
import { useDepositStore } from '@/store/useDepositStore';
import { useOnramperStore } from '@/store/useOnramperStore';

const PILL_ICON_STYLE = { width: 24, height: 24 };
const SELECTOR_ICON_STYLE = { width: 20, height: 20 };

const formatAmount = (value: number | undefined, maximumFractionDigits = 2) =>
  value == null ? '—' : new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);

/**
 * Primary Onramper screen: enter what you want to spend, pick the currency and
 * the asset, and check out with the native Apple Pay button underneath.
 *
 * Priced from the fiat side, unlike the TransFi screen next door — Onramper's
 * quote takes an amount in the paying currency and returns the crypto payout, so
 * the box is the spend and "You receive" is the result. There is no Continue
 * button: `getCheckoutRequirements()` returns the quote *and* the button that
 * consumes it, so the CTA only exists once a quote does.
 */
export const OnramperAmount = () => {
  const setModal = useBuyCryptoNavigation();
  const closeDeposit = useDepositStore(state => state.setModal);
  const { user } = useUser();
  const { countryCode, isAvailable, isCountryOverridden } = useOnramperAvailability();

  const fiatAmount = useOnramperStore(state => state.fiatAmount);
  const fiatCurrency = useOnramperStore(state => state.fiatCurrency);
  const assetId = useOnramperStore(state => state.assetId);
  const setFiatAmount = useOnramperStore(state => state.setFiatAmount);
  const setFiatCurrency = useOnramperStore(state => state.setFiatCurrency);
  const setAssetId = useOnramperStore(state => state.setAssetId);

  const { client, isLoading: clientLoading, error: clientError, retry } = useOnramperClient();
  const { data: config, isLoading: configLoading } = useOnramperConfig(countryCode);
  const { data: assetData, isLoading: assetsLoading } = useOnramperAssets(
    fiatCurrency ?? undefined,
    countryCode,
  );

  useEffect(() => {
    track(TRACKING_EVENTS.ONRAMPER_AMOUNT_VIEWED, { country: countryCode });
  }, [countryCode]);

  // Preselect the currency Onramper recommends for this country. `config`
  // reports a code ('USD') while a checkout takes the id ('usd'), so the match
  // goes through the currency list rather than lowercasing blindly.
  useEffect(() => {
    if (fiatCurrency || !config) return;
    const preferred =
      config.currencies.find(c => c.code === config.defaultCurrency) ?? config.currencies[0];
    if (preferred) setFiatCurrency(preferred.id);
  }, [config, fiatCurrency, setFiatCurrency]);

  // Memoized because the `?? []` fallback is a fresh array each render, which
  // would re-run the preselect effect below on every one of them.
  const assets = useMemo(() => assetData?.assets ?? [], [assetData?.assets]);
  const paymentMethod = assetData?.paymentMethods?.[0];

  // Land on the first deliverable asset so the screen can quote immediately.
  // The list is ordered cheapest-network-first by the backend.
  useEffect(() => {
    if (assetId || assets.length === 0) return;
    setAssetId(assets[0].id);
  }, [assetId, assets, setAssetId]);

  const selectedCurrency = useMemo(
    () => config?.currencies.find(c => c.id === fiatCurrency),
    [config?.currencies, fiatCurrency],
  );
  const selectedAsset = useMemo(() => assets.find(a => a.id === assetId), [assets, assetId]);

  const {
    button,
    quote,
    isLoading: quoteLoading,
    error: quoteError,
    isAmountOutOfRange,
  } = useOnramperCheckout(client, {
    source: fiatCurrency,
    destination: assetId,
    amount: fiatAmount,
    paymentMethod: paymentMethod?.id,
    country: countryCode,
    network: selectedAsset?.network,
    // The user's Safe, as requested. Worth knowing: the deposit webhook matches
    // incoming transfers against registered direct-deposit addresses only, and
    // the Safe is not registered on any EVM stream — so a delivery on Ethereum
    // or Base is not currently detected or bridged. Crediting it needs a change
    // on the backend side, not here.
    address: user?.safeAddress,
  });

  // What the checkout listeners below report. Held in a ref so they can be
  // subscribed once per client instead of being torn down and rebuilt on every
  // keystroke, while still reporting the selection as it stands at the moment
  // the SDK fires.
  const selection = useRef({ fiatCurrency, assetId, fiatAmount, assetCode: selectedAsset?.code });
  selection.current = { fiatCurrency, assetId, fiatAmount, assetCode: selectedAsset?.code };

  // Checkout runs inside the SDK once the button is tapped, so its outcome only
  // reaches us as an event. Without this the user would complete Apple Pay and
  // be left staring at the amount screen.
  useEffect(() => {
    if (!client) return;

    const unsubscribers = [
      client.addEventListener('completed', ({ checkoutId }) => {
        const {
          fiatCurrency: currency,
          assetId: asset,
          fiatAmount: amount,
          assetCode,
        } = selection.current;
        track(TRACKING_EVENTS.ONRAMPER_CHECKOUT_COMPLETED, {
          checkout_id: checkoutId,
          currency: currency ?? undefined,
          asset_id: asset ?? undefined,
          fiat_amount: Number(amount) || undefined,
        });
        Toast.show({
          type: 'success',
          text1: 'Purchase complete',
          text2: `Your ${assetCode ?? 'crypto'} will arrive in your wallet shortly.`,
        });
        closeDeposit(DEPOSIT_MODAL.CLOSE);
      }),
      client.addEventListener('failed', ({ error }) => {
        const { fiatCurrency: currency, assetId: asset } = selection.current;
        track(TRACKING_EVENTS.ONRAMPER_CHECKOUT_FAILED, {
          error_code: error.code,
          error_message: error.message,
          currency: currency ?? undefined,
          asset_id: asset ?? undefined,
        });
        Toast.show({
          type: 'error',
          text1: 'Purchase failed',
          text2: error.message,
        });
      }),
      client.addEventListener('cancelled', () => {
        const { fiatCurrency: currency, assetId: asset } = selection.current;
        track(TRACKING_EVENTS.ONRAMPER_CHECKOUT_CANCELLED, {
          currency: currency ?? undefined,
          asset_id: asset ?? undefined,
        });
      }),
    ];

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [client, closeDeposit]);

  useEffect(() => {
    if (!quote) return;
    track(TRACKING_EVENTS.ONRAMPER_QUOTE_READY, {
      ramp: quote.ramp,
      currency: fiatCurrency ?? undefined,
      asset_id: assetId ?? undefined,
      fiat_amount: Number(fiatAmount) || undefined,
      payout: quote.payout,
    });
  }, [quote, fiatCurrency, assetId, fiatAmount]);

  useEffect(() => {
    if (!quoteError) return;
    track(TRACKING_EVENTS.ONRAMPER_QUOTE_FAILED, {
      error_code: quoteError.code,
      error_message: quoteError.message,
      currency: fiatCurrency ?? undefined,
      asset_id: assetId ?? undefined,
      fiat_amount: Number(fiatAmount) || undefined,
    });
  }, [quoteError, fiatCurrency, assetId, fiatAmount]);

  const currencyCode = selectedCurrency?.code ?? fiatCurrency?.toUpperCase() ?? '';
  const limits = selectedAsset?.limits;
  const amountNumber = Number(fiatAmount);
  const hasAmount = Number.isFinite(amountNumber) && amountNumber > 0;
  const belowMin = hasAmount && limits?.min != null && amountNumber < limits.min;
  const aboveMax = hasAmount && limits?.max != null && amountNumber > limits.max;
  const totalFee =
    quote == null ? undefined : (quote.networkFee ?? 0) + (quote.transactionFee ?? 0);

  // The client bootstrap needs an authenticated session and a supported
  // platform. A failure here is not the user's doing and is usually transient,
  // so it offers a retry rather than an explanation.
  if (clientError) {
    return (
      <View className="shrink-0 gap-6">
        <View className="gap-2 rounded-[15px] bg-[#1C1C1C] p-4">
          <Text className="text-base font-semibold text-white">Couldn&apos;t start checkout</Text>
          <Text className="text-sm font-medium leading-5 text-white/70">
            We couldn&apos;t reach our payment provider. Check your connection and try again.
          </Text>
          {/* The sentence above is all a real user can act on. On qa/preview
              builds the code is what someone debugging actually needs, and
              reading it here beats tailing the bundler on a physical device. */}
          {isDevFeatureEnabled ? (
            <Text
              selectable
              className="mt-1 text-xs leading-[17px] text-amber-300"
              style={{ fontFamily: 'monospace' }}
            >
              {describeOnramperError(clientError)}
            </Text>
          ) : null}
        </View>
        <Button className="h-12 rounded-full" variant="brand" onPress={retry}>
          <Text className="text-base font-bold text-black">Try again</Text>
        </Button>
        {/* A stale stored OnramperID login can be what the bootstrap trips on,
            and it survives reinstalls of the JS bundle because it lives in the
            native keychain. Clearing it is a diagnostic step, not something to
            offer a real user, so it is qa/preview only. */}
        {isDevFeatureEnabled ? (
          <Pressable
            accessibilityRole="button"
            className="h-11 items-center justify-center rounded-full border border-white/20 active:opacity-70"
            onPress={() => {
              void signOutOnramper().then(retry);
            }}
          >
            <Text className="text-sm font-semibold text-white/70">
              Clear Onramper login and retry
            </Text>
          </Pressable>
        ) : null}
        <NeedHelp />
      </View>
    );
  }

  if (clientLoading || configLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#94F27F" />
      </View>
    );
  }

  // Onramper only prices for a handful of countries. Reaching this screen from
  // an unsupported one means the entry row's gate and the geo lookup disagreed
  // — say so plainly instead of showing inputs that never produce a button.
  if (!isAvailable) {
    return (
      <View className="shrink-0 gap-6">
        <View className="gap-2 rounded-[15px] bg-[#1C1C1C] p-4">
          <Text className="text-base font-semibold text-white">Not available here</Text>
          <Text className="text-sm font-medium leading-5 text-white/70">
            Buying crypto with Apple Pay isn&apos;t available in your region yet.
          </Text>
        </View>
        <NeedHelp />
      </View>
    );
  }

  return (
    <View className="shrink-0 gap-6">
      {/* Tappable on qa/preview so a tester can try another country without a
          rebuild. Always says which country is in force: a forced one produces
          a flow that works here and would not for a real user in that region,
          and a successful test would otherwise read as proof the region is
          live. */}
      {isDevFeatureEnabled ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Testing country: ${countryCode || 'not set'}. Tap to change.`}
          className="flex-row items-center justify-between gap-3 rounded-[10px] border border-amber-400/40 bg-amber-400/10 px-3 py-2 active:opacity-70"
          onPress={() => setModal(DEPOSIT_MODAL.OPEN_ONRAMPER_COUNTRY)}
        >
          <Text className="flex-1 text-xs font-medium leading-[17px] text-amber-300">
            Testing as {countryCode || '—'}
            {isCountryOverridden ? '' : ' (detected)'} · tap to change
          </Text>
          <ChevronDown size={14} color="#FCD34D" />
        </Pressable>
      ) : null}

      <View className="gap-2.5">
        <Text className="text-base font-medium text-white/70">You pay</Text>
        <View className="h-[80px] flex-row items-center justify-between rounded-[15px] bg-[#1C1C1C] pl-4 pr-3.5">
          <View className="mr-3 flex-1">
            <TextInput
              accessibilityLabel={`Amount in ${currencyCode}`}
              value={fiatAmount}
              onChangeText={text => setFiatAmount(text.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor="rgba(255,255,255,0.5)"
              className="p-0 text-3xl font-semibold text-white web:outline-none"
              style={{ fontFamily: 'MonaSans_600SemiBold' }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Currency: ${currencyCode || 'not selected'}`}
            className="h-12 shrink-0 flex-row items-center gap-[7px] rounded-full bg-white/10 px-3 active:opacity-80"
            onPress={() => setModal(DEPOSIT_MODAL.OPEN_ONRAMPER_CURRENCY)}
          >
            {selectedCurrency?.icon ? (
              <Image
                source={{ uri: selectedCurrency.icon }}
                style={PILL_ICON_STYLE}
                contentFit="contain"
              />
            ) : null}
            <Text className="text-lg font-semibold text-white">{currencyCode || 'Select'}</Text>
            <ChevronDown size={16} color="#FFFFFF" />
          </Pressable>
        </View>
        {limits?.min != null || limits?.max != null ? (
          <Text className="text-xs font-medium leading-[18px] text-white/50">
            Limits: {formatAmount(limits?.min)} – {formatAmount(limits?.max)} {currencyCode}
          </Text>
        ) : null}
      </View>

      <View className="gap-2.5">
        <Text className="text-base font-medium leading-[22px] text-white/70">You receive</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Asset: ${selectedAsset ? `${selectedAsset.code} on ${selectedAsset.networkName}` : 'not selected'}`}
          className="h-[62px] flex-row items-center justify-between rounded-[15px] bg-[#1C1C1C] px-3.5 active:opacity-80"
          onPress={() => setModal(DEPOSIT_MODAL.OPEN_ONRAMPER_ASSET)}
          disabled={assetsLoading || assets.length === 0}
        >
          <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
            {selectedAsset?.icon ? (
              <Image
                source={{ uri: selectedAsset.icon }}
                style={SELECTOR_ICON_STYLE}
                contentFit="contain"
              />
            ) : null}
            <Text className="text-base font-medium text-white" numberOfLines={1}>
              {selectedAsset?.code ?? (assetsLoading ? 'Loading…' : 'Select asset')}
            </Text>
            {selectedAsset ? <CardFundChip label={selectedAsset.networkName} /> : null}
          </View>
          <ChevronDown size={18} color="#FFFFFF" />
        </Pressable>
        {selectedAsset ? (
          <Text className="text-sm font-medium leading-5 text-white/70">
            You&apos;ll receive {selectedAsset.code} on {selectedAsset.networkName} in your wallet
          </Text>
        ) : null}
      </View>

      <View className="gap-2 rounded-[15px] bg-[#1C1C1C] p-4">
        <Text className="text-base font-semibold leading-[22px] text-white">Your quote</Text>
        {!quote ? (
          <View className="min-h-10 justify-center">
            {quoteLoading ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#94F27F" />
                <Text className="text-sm font-medium leading-5 text-white/70">
                  Getting your rate, fees, and total…
                </Text>
              </View>
            ) : (
              <Text className="text-sm font-medium leading-5 text-white/70">
                Enter an amount to see what you&apos;ll receive.
              </Text>
            )}
          </View>
        ) : (
          <View className="gap-2.5">
            <QuoteRow
              label="You receive"
              value={`${formatAmount(quote.payout, 6)} ${selectedAsset?.code ?? ''}`}
            />
            <QuoteRow label="Fees" value={`${formatAmount(totalFee)} ${currencyCode}`} />
            {quote.ramp ? <QuoteRow label="Provider" value={quote.ramp} /> : null}
            <View className="h-px bg-white/10" />
            <QuoteRow
              label="Total you pay"
              value={`${formatAmount(amountNumber)} ${currencyCode}`}
              emphasize
            />
          </View>
        )}
        {belowMin ? (
          <Text className="text-xs text-red-500">
            Enter at least {formatAmount(limits?.min)} {currencyCode}.
          </Text>
        ) : null}
        {aboveMax ? (
          <Text className="text-xs text-red-500">
            Enter at most {formatAmount(limits?.max)} {currencyCode}.
          </Text>
        ) : null}
        {/* Onramper priced the amount out of range but our cached limits didn't
            catch it — show its own words rather than leaving the box silent. */}
        {isAmountOutOfRange && !belowMin && !aboveMax ? (
          <Text className="text-xs text-red-500">{quoteError?.message}</Text>
        ) : null}
        {quoteError && !isAmountOutOfRange ? (
          <Text className="text-xs text-red-500">{quoteError.message}</Text>
        ) : null}
      </View>

      <View className="gap-[18px]">
        <Text className="text-xs font-medium leading-[17px] text-white/50">
          Crypto purchases are provided by Onramper. Rates and fees are set by Onramper and its
          partners and may change.
        </Text>

        {/* The native Apple Pay button *is* the CTA — it only exists once a
            quote does, so the placeholder below stands in until then rather
            than a disabled button that could be mistaken for it. */}
        {button ?? (
          <View className="h-12 items-center justify-center rounded-full bg-white/20">
            <Text className="text-base font-bold text-white">
              {quoteLoading
                ? 'Getting quote…'
                : belowMin || aboveMax || isAmountOutOfRange
                  ? 'Amount out of limits'
                  : hasAmount
                    ? 'Quote unavailable'
                    : 'Enter an amount'}
            </Text>
          </View>
        )}

        <NeedHelp />
      </View>
    </View>
  );
};

const QuoteRow = ({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) => (
  <View className="flex-row items-center justify-between">
    <Text
      className={
        emphasize ? 'text-base font-semibold text-primary' : 'text-sm text-muted-foreground'
      }
    >
      {label}
    </Text>
    <Text className={emphasize ? 'text-base font-bold text-primary' : 'text-sm text-primary'}>
      {value}
    </Text>
  </View>
);

export default OnramperAmount;
