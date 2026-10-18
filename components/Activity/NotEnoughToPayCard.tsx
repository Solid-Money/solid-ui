import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Address } from 'viem';
import { fuse } from 'viem/chains';

import { useMovableHoldings } from '@/components/Card/CardFund/WirexMoveFromWallet';
import WirexCardFundModal from '@/components/Card/WirexCardFundModal';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { USDC_STARGATE } from '@/constants/addresses';
import { SWAP_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardSpendable } from '@/hooks/useCardSpendable';
import { useUnusableEurc } from '@/hooks/useUnusableEurc';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { CardTransaction } from '@/lib/types';
import { SwapField } from '@/lib/types/swap-field';
import {
  chooseDeclineFix,
  declinedPaymentFigures,
  DeclineFix,
  formatCardCurrency,
  roundUpShortfall,
  shortfallOf,
} from '@/lib/utils/cardCurrency';
import { useSwapState } from '@/store/swapStore';

/**
 * How often the live balance is re-read while the payment is still not covered — long enough not
 * to poll a chain read hard, short enough that "You now have €25.00 available" lands while the
 * cardholder is still at the till.
 */
const UNCOVERED_POLL_MS = 15_000;

// Figma 28823:9353 — exact pixel sizes, as everywhere on this screen: the Tailwind
// scale is remapped on native and the design asks for the same sizes on every platform.
const ROW_LABEL = 'text-[15px] font-normal text-white/70';
const ROW_VALUE = 'text-[15px] font-medium text-white';
const PRIMARY_BUTTON =
  'w-full items-center justify-center rounded-full bg-white py-3 active:scale-[0.98] active:opacity-80 disabled:opacity-60 web:hover:opacity-90';
const SECONDARY_BUTTON =
  'w-full items-center justify-center rounded-full bg-white/10 py-3 active:scale-[0.98] active:opacity-80 web:hover:bg-white/15';

/** "0.5", "0.0123" — a holding in its own units, to four places. */
const tokenAmount = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 4 });

/**
 * The token amount that swaps for `usd`, in the holding's units: rounded up at six places so the
 * swap never comes out a fraction short, and capped at what they hold. Exact-in, because the
 * cross-chain form quotes nothing else.
 */
const swapInputFor = (usd: number, holding: { amount: number; valueUSD: number }) => {
  const price = holding.valueUSD / holding.amount;
  if (!Number.isFinite(price) || price <= 0) return undefined;
  const units = Math.min(Math.ceil((usd / price) * 1e6) / 1e6, holding.amount);
  return units > 0 ? units.toFixed(6).replace(/\.?0+$/, '') : undefined;
};

interface NotEnoughToPayCardProps {
  transaction: CardTransaction;
}

/**
 * "Not enough to pay" — the gap a Wirex payment was declined for, and the one button that closes
 * it (Figma 28823:9338, 28826:9271).
 *
 * The decline push opens this receipt, and the receipt is where the fix lives: there is no
 * separate sheet. It names the payment and what the card can spend now — live, re-read while the
 * payment is still not covered — in the currency the till charged, which is the comparison nobody
 * could make on Oct 15 with a dollar balance and a euro till.
 *
 * The fix is decided here, from what the cardholder holds now, rather than read off the push: the
 * receipt is also reached from the activity list, and what they hold may have changed since the
 * push went out. The order is the push's — see `chooseDeclineFix`.
 *
 * Once the balance covers the payment the buttons give way to "Ask the shop to try again", which
 * is the only thing left to do.
 */
const NotEnoughToPayCard = ({ transaction }: NotEnoughToPayCardProps) => {
  const [isFundOpen, setIsFundOpen] = useState(false);
  const [covered, setCovered] = useState(false);

  const { data: spendable } = useCardSpendable({
    refetchInterval: covered ? false : UNCOVERED_POLL_MS,
  });
  const { eurc, euroSpend } = useUnusableEurc();
  const { swappable } = useMovableHoldings();

  const figures = useMemo(
    () => declinedPaymentFigures(transaction, spendable),
    [transaction, spendable],
  );
  const { payment, available, comparable } = figures;
  const isCovered = !!comparable && comparable.available >= comparable.payment;

  useEffect(() => {
    setCovered(isCovered);
  }, [isCovered]);

  // In the comparison's currency — the card's own for the usual euro payment.
  const shortfall = comparable ? shortfallOf(comparable) : undefined;
  const target = comparable ? roundUpShortfall(shortfall ?? 0) : undefined;
  const rateToUsd = comparable?.rateToUsd ?? 1;
  const holding = swappable[0];

  const fix: DeclineFix = chooseDeclineFix({
    payment,
    merchantCurrency: transaction.currency,
    unusableEurc: eurc,
    swapValueUsd: holding?.valueUSD,
    shortfallUsd: shortfall !== undefined ? shortfall * rateToUsd : undefined,
  });

  // Once per receipt, and only once the live figure is in, so `covered` means what it says.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current || !spendable) return;
    viewedRef.current = true;
    track(TRACKING_EVENTS.CARD_DECLINE_FIX_VIEWED, {
      transaction_id: transaction.id,
      fix,
      covered: isCovered,
      currency: payment.currency,
      shortfall,
    });
  }, [spendable, fix, isCovered, payment.currency, shortfall, transaction.id]);

  const trackPress = useCallback(
    (button: DeclineFix) =>
      track(TRACKING_EVENTS.CARD_DECLINE_FIX_PRESSED, {
        transaction_id: transaction.id,
        fix,
        button,
        currency: payment.currency,
        shortfall,
      }),
    [fix, payment.currency, shortfall, transaction.id],
  );

  const openAddFunds = useCallback(() => {
    trackPress('add_funds');
    setIsFundOpen(true);
  }, [trackPress]);

  const turnOnEuro = useCallback(() => {
    trackPress('turn_on_euro');
    euroSpend.enable('declined_receipt');
  }, [euroSpend, trackPress]);

  const swapUsd = (target ?? 0) * rateToUsd;
  const swapInput = holding ? swapInputFor(swapUsd, holding) : undefined;

  const openSwap = useCallback(() => {
    if (!holding) return;
    trackPress('swap');
    const { selectCurrency, resetForm, typeInput, setModal } = useSwapState.getState().actions;
    // The same pair "Move from wallet › Swap first" opens: into USDC on Fuse, which the card
    // spends the moment it lands.
    selectCurrency(SwapField.INPUT, holding.tokenAddress as Address, holding.chainId);
    selectCurrency(SwapField.OUTPUT, USDC_STARGATE, fuse.id);
    resetForm();
    if (swapInput) typeInput(SwapField.INPUT, swapInput);
    setModal(SWAP_MODAL.OPEN_FORM);
  }, [holding, swapInput, trackPress]);

  // What "Move from wallet" starts at: the gap, rounded up, in the dollars it moves.
  const suggestedAmountUsd = target ? Math.ceil(target * rateToUsd) : undefined;

  const currency = comparable?.currency ?? payment.currency;

  return (
    <View className="gap-3 rounded-[20px] border border-white/[0.12] bg-card p-4">
      <Text className="text-[17px] font-semibold text-white">Not enough to pay</Text>

      <View className="flex-row items-start justify-between">
        <Text className={ROW_LABEL}>Payment</Text>
        <Text className={ROW_VALUE}>{formatCardCurrency(payment.amount, payment.currency)}</Text>
      </View>
      <View className="flex-row items-start justify-between">
        <Text className={ROW_LABEL}>Available to spend</Text>
        <Text className={ROW_VALUE}>
          {available ? formatCardCurrency(available.amount, available.currency) : '—'}
        </Text>
      </View>

      {isCovered && available ? (
        <Text className="text-center text-[14px] text-white/60">
          {`You now have ${formatCardCurrency(available.amount, available.currency)} available. Ask the shop to try again.`}
        </Text>
      ) : (
        <>
          {fix === 'swap' && holding ? (
            <>
              <View className="h-px w-full bg-white/10" />
              <View className="flex-row items-center gap-3">
                <RenderTokenIcon
                  tokenIcon={getTokenIcon({
                    logoUrl: holding.logoUrl,
                    tokenSymbol: holding.symbol,
                  })}
                  size={36}
                  tokenName={holding.symbol}
                />
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="text-[15px] font-medium text-white">
                    {`You have ${tokenAmount(holding.amount)} ${holding.symbol} (${formatCardCurrency(
                      Math.floor(holding.valueUSD / rateToUsd),
                      currency,
                      { trimWhole: true },
                    )})`}
                  </Text>
                  <Text className="text-[13px] text-white/70">
                    Swap some to USDC and your card can use it right away.
                  </Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" className={PRIMARY_BUTTON} onPress={openSwap}>
                <Text className="text-[16px] font-semibold text-black">
                  {target
                    ? `Swap ${formatCardCurrency(target, currency, { trimWhole: true })} of ${holding.symbol}`
                    : `Swap ${holding.symbol}`}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className={SECONDARY_BUTTON}
                onPress={openAddFunds}
              >
                <Text className="text-[16px] font-semibold text-white">Add funds instead</Text>
              </Pressable>
            </>
          ) : fix === 'turn_on_euro' ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: euroSpend.isEnabling, busy: euroSpend.isEnabling }}
                // Disabled while the enable user operation is in flight: a second batch against a
                // Safe the first is registering reverts `AlreadyRegistered`.
                disabled={euroSpend.isEnabling}
                className={PRIMARY_BUTTON}
                onPress={turnOnEuro}
              >
                {euroSpend.isEnabling ? (
                  <ActivityIndicator color="black" size="small" />
                ) : (
                  <Text className="text-[16px] font-semibold text-black">
                    Turn on euro spending
                  </Text>
                )}
              </Pressable>
              {euroSpend.error ? (
                <Text className="text-center text-[14px] text-red-400">{euroSpend.error}</Text>
              ) : null}
            </>
          ) : (
            <Pressable accessibilityRole="button" className={PRIMARY_BUTTON} onPress={openAddFunds}>
              <Text className="text-[16px] font-semibold text-black">Add funds</Text>
            </Pressable>
          )}
          <Text className="text-center text-[14px] text-white/60">
            Then ask the shop to try your card again.
          </Text>
        </>
      )}

      <WirexCardFundModal
        isOpen={isFundOpen}
        onOpenChange={setIsFundOpen}
        suggestedAmountUsd={suggestedAmountUsd}
      />
    </View>
  );
};

export default NotEnoughToPayCard;
