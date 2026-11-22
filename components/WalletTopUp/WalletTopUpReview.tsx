import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import Toast from 'react-native-toast-message';

import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import WalletCheckout from '@/components/WalletTopUp/WalletCheckout';
import { useWalletTopUpNavigation } from '@/components/WalletTopUp/WalletTopUpNavigation';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCreateWalletTopUpQuote, useWalletTopUpStatus } from '@/hooks/useWalletTopUp';
import { useWalletTopUpAvailability } from '@/hooks/useWalletTopUpAvailability';
import { track } from '@/lib/analytics';
import {
  formatWalletTopUpMoney,
  formatWalletTopUpTokenAmount,
  getWalletExecuteFailureAction,
  getWalletTopUpPlatform,
  getWalletTopUpQuoteErrorMessage,
  toWalletTopUpWireAmount,
  WALLET_TOPUP_METHOD_LABEL,
} from '@/lib/walletTopUp';
import { useWalletTopUpStore, WalletTopUpStatusEntry } from '@/store/useWalletTopUpStore';

import type { WalletCheckoutHandlers } from '@/components/WalletTopUp/WalletCheckout.types';

/**
 * The web checkout is compact — just Wirex's total, button and countdown — so the
 * fee is ours to show. The native checkout lists the fee and rate itself.
 */
const SHOWS_PRICE_DETAILS = Platform.OS === 'web';

const ReviewRow = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View
    className={`flex-row items-center justify-between gap-4 p-5 ${last ? '' : 'border-b border-foreground/10'}`}
  >
    <Text className="text-base text-muted-foreground">{label}</Text>
    <Text className="flex-1 text-right text-base font-semibold" numberOfLines={1}>
      {value}
    </Text>
  </View>
);

/**
 * Second step: our summary of the top-up, with Wirex's checkout — the total, the
 * Apple Pay or Google Pay button and the price countdown — under it.
 *
 * The checkout executes the top-up itself (token mode). This step re-prices when
 * the quote runs out on screen, and hands over to the status step once the
 * top-up has been executed or might have been: from then on only the backend's
 * status says what happened to the money.
 */
export const WalletTopUpReview = () => {
  const navigate = useWalletTopUpNavigation();
  // Not `availability`, which fails closed for the entry row: a failed refetch
  // must not unmount a checkout the user is paying through.
  const { checkoutSdk: sdk, refetch: refetchAvailability } = useWalletTopUpAvailability();

  const method = useWalletTopUpStore(state => state.method);
  const source = useWalletTopUpStore(state => state.source);
  const amount = useWalletTopUpStore(state => state.amount);
  const currency = useWalletTopUpStore(state => state.currency);
  const checkout = useWalletTopUpStore(state => state.quote);
  const setQuote = useWalletTopUpStore(state => state.setQuote);
  const endCheckout = useWalletTopUpStore(state => state.endCheckout);

  const { mutate: requote, isPending: isRequoting } = useCreateWalletTopUpQuote();
  const [error, setError] = useState<string | null>(null);
  // Remounts the checkout after it failed to load: that mount has nothing more to say.
  const [checkoutKey, setCheckoutKey] = useState(0);
  const [isHandoffPending, setIsHandoffPending] = useState(false);

  const label = WALLET_TOPUP_METHOD_LABEL[method];
  const estimationId = checkout?.estimationId;

  const analytics = useMemo(
    () => ({ payment_method: method, source, currency, estimation_id: estimationId }),
    [currency, estimationId, method, source],
  );

  // The checkout's work is done (or may be): the token goes, the status step reads the rest.
  const goToStatus = useCallback(
    (entry: WalletTopUpStatusEntry) => {
      navigate(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_STATUS);
      endCheckout(entry);
    },
    [endCheckout, navigate],
  );

  /**
   * A fresh quote with its own checkout token. The checkout is hidden while it
   * is fetched (nothing can be paid on the old estimation), and an error on
   * screen stays, its retry disabled, until the new quote is in.
   */
  const refreshQuote = useCallback(
    (reason: string, remount = false) => {
      if (!currency) return;
      requote(
        {
          amount: toWalletTopUpWireAmount(amount),
          currency,
          paymentMethod: method,
          platform: getWalletTopUpPlatform(Platform.OS),
        },
        {
          onSuccess: next => {
            track(TRACKING_EVENTS.WALLET_TOPUP_QUOTE_REFRESHED, { ...analytics, reason });
            setError(null);
            setQuote(next);
            if (remount) setCheckoutKey(key => key + 1);
          },
          onError: requoteError => {
            track(TRACKING_EVENTS.WALLET_TOPUP_QUOTE_FAILED, {
              ...analytics,
              during: 'refresh',
              reason,
              status: (requoteError as { status?: number }).status,
              code: (requoteError as { code?: string }).code,
            });
            setError(getWalletTopUpQuoteErrorMessage(requoteError, method));
          },
        },
      );
    },
    [amount, analytics, currency, method, requote, setQuote],
  );

  const handlers = useMemo<WalletCheckoutHandlers>(
    () => ({
      onSheetOpen: () => track(TRACKING_EVENTS.WALLET_TOPUP_SHEET_OPENED, analytics),
      // Closing the sheet changes nothing; the button is still there.
      onCancel: () => track(TRACKING_EVENTS.WALLET_TOPUP_CANCELLED, analytics),
      onAttemptFailed: reason => {
        track(TRACKING_EVENTS.WALLET_TOPUP_ATTEMPT_FAILED, { ...analytics, reason });
        Toast.show({
          type: 'error',
          text1: `${label} didn't go through`,
          text2: 'Nothing was charged. Try again.',
        });
      },
      onEstimationExpired: () => refreshQuote('expired'),
      onExecuted: result => {
        track(TRACKING_EVENTS.WALLET_TOPUP_EXECUTED, { ...analytics, status: result.status });
        goToStatus('executed');
      },
      onExecuteFailed: ({ reason, status }) => {
        const action = getWalletExecuteFailureAction(reason);
        track(TRACKING_EVENTS.WALLET_TOPUP_EXECUTE_FAILED, {
          ...analytics,
          reason,
          status,
          action,
        });
        if (action === 'reconcile') {
          // The card may have been charged. Only the status can say, so it decides.
          Toast.show({ type: 'info', text1: 'Checking your top-up…' });
          goToStatus('reconcile');
          return;
        }
        if (action === 'retry') {
          Toast.show({
            type: 'error',
            text1: "Your top-up didn't go through",
            text2: 'Nothing was charged. Try again.',
          });
        }
        // The checkout stays disabled until it has a fresh quote and token.
        refreshQuote(reason);
      },
      onLoadFailed: kind => {
        track(TRACKING_EVENTS.WALLET_TOPUP_CHECKOUT_FAILED, { ...analytics, kind });
        setError(`We couldn't load ${label} right now.`);
      },
      onHandoffPending: () => {
        track(TRACKING_EVENTS.WALLET_TOPUP_HANDOFF_STARTED, analytics);
        setIsHandoffPending(true);
      },
    }),
    [analytics, goToStatus, label, refreshQuote],
  );

  // Desktop web: the phone that scanned the QR pays and executes, and this page
  // never hears about it. Watch the status while the QR stays up, and move on
  // once Wirex has the top-up. An expired quote is not news here: the checkout
  // re-prices it, and the QR with it.
  const { data: handoffStatus } = useWalletTopUpStatus(isHandoffPending ? estimationId : null);
  useEffect(() => {
    if (!handoffStatus) return;
    if (handoffStatus.status === 'quoted' || handoffStatus.status === 'expired') return;
    goToStatus('handoff');
  }, [goToStatus, handoffStatus]);

  if (!checkout) return null;

  // No SDK config (the backend stopped offering the top-up) leaves no checkout to
  // show: say so, with the retry, rather than an empty step.
  const shownError = error ?? (sdk ? null : `We couldn't load ${label} right now.`);

  const handleRetry = () => {
    if (!sdk) void refetchAvailability();
    refreshQuote('retry', true);
  };

  const { destinationAmount, fee } = checkout.quote;

  // No rate row: Wirex documents `rate` only as "card-to-reference-currency", so
  // which way round it reads is not pinned down, and the total Wirex shows under
  // this already says what the card is charged.
  const rows = [
    {
      label: 'You get',
      value: formatWalletTopUpTokenAmount(destinationAmount.amount, destinationAmount.currency),
    },
    { label: 'To', value: 'Solid wallet' },
    ...(SHOWS_PRICE_DETAILS && fee
      ? [{ label: 'Fee', value: formatWalletTopUpMoney(fee.amount, fee.currency) }]
      : []),
  ];

  return (
    <View className="shrink-0 gap-6">
      <View className="rounded-2xl bg-card">
        {rows.map((row, index) => (
          <ReviewRow
            key={row.label}
            label={row.label}
            value={row.value}
            last={index === rows.length - 1}
          />
        ))}
      </View>

      {isRequoting ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color="#94F27F" />
          <Text className="text-sm font-medium leading-5 text-white/70">Getting a new price…</Text>
        </View>
      ) : null}

      {shownError || !sdk ? (
        <View className="gap-3 rounded-[15px] bg-[#1C1C1C] p-4">
          <Text className="text-sm text-red-500">{shownError}</Text>
          <Button
            className="h-12 rounded-full"
            variant="secondary"
            disabled={isRequoting}
            onPress={handleRetry}
          >
            <Text className="text-base font-semibold text-white">Try again</Text>
          </Button>
        </View>
      ) : isRequoting ? null : (
        <WalletCheckout key={checkoutKey} sdk={sdk} checkout={checkout} handlers={handlers} />
      )}

      {isHandoffPending ? (
        <Text className="text-sm font-medium leading-5 text-white/70">
          Finish paying on your phone. This page moves on by itself once you have.
        </Text>
      ) : null}

      <NeedHelp />
    </View>
  );
};

export default WalletTopUpReview;
