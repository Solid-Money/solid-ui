import type {
  CardCurrencyAmount,
  CardSpendableResponse,
  CardSpendDetails,
  CardTransaction,
} from '@/lib/types';

/**
 * Money in a Wirex card's own currency — the euros most Wirex cards are billed in.
 *
 * Kept apart from the dollar formatters on purpose. The app has only ever shown a
 * Wirex balance in dollars, and on Oct 15 that is what declined five people who
 * looked at "$14.46" and paid €12.80: the till charges euros. Everything here is
 * about saying the figure in the currency the till will use.
 *
 * Pure, so the arithmetic that decides "you are €0.07 short" is tested without
 * a screen.
 */

/** A figure and the ISO 4217 currency it is in. */
export interface Money {
  amount: number;
  currency: string;
}

/**
 * "€983.47", "£12.00", "$1,120.00" — two places by default, because these are
 * balances and payments set side by side.
 *
 * `wholeZero` writes nothing at all as "€0": in a sentence ("You have €0
 * available to spend") two decimal places of nothing read as a figure to check.
 * `trimWhole` does the same for any whole amount — "Swap €20 of ETH" is a round
 * figure to tap, not a balance to reconcile.
 */
export const formatCardCurrency = (
  amount: number,
  currency: string,
  options: { wholeZero?: boolean; trimWhole?: boolean } = {},
): string => {
  const code = currency.trim().toUpperCase();
  const whole =
    (options.wholeZero && amount === 0) || (options.trimWhole && Number.isInteger(amount));
  const digits = whole ? 0 : 2;
  try {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  } catch {
    // A code Intl does not know must not take the receipt down with it.
    return `${amount.toFixed(digits)} ${code}`;
  }
};

/** The backend's own cut-off: a figure on a quote older than this is not sent at all. */
const QUOTE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * `available_in_card_currency` as a number, or undefined when it is missing, malformed or on a
 * quote a day old or more.
 *
 * The backend never sends a stale quote, but a response can outlive its quote in the cache, and
 * "≈ $1,120.00 at today's rate" must not be yesterday's. Only age counts: a phone clock running
 * behind is no reason to hide a quote that reads as from the future.
 */
export const cardCurrencyFigure = (
  figure?: CardCurrencyAmount | null,
  now: number = Date.now(),
): Money | undefined => {
  if (!figure?.currency || typeof figure.amount !== 'string' || !figure.amount.trim()) {
    return undefined;
  }
  const amount = Number(figure.amount);
  const quotedAt = Date.parse(figure.rate_at);
  if (!Number.isFinite(amount) || !Number.isFinite(quotedAt)) return undefined;
  if (now - quotedAt >= QUOTE_MAX_AGE_MS) return undefined;
  return { amount, currency: figure.currency.trim().toUpperCase() };
};

/**
 * What the Available to spend tile and the balance panel show: the card's own
 * currency when the backend has a figure in it, dollars otherwise.
 *
 * @returns the label, and the dollar figure it was converted from when it was —
 *          which is what "≈ $1,120.00 at today's rate" quotes.
 */
export const spendableDisplay = (balances?: {
  available?: { amount?: string };
  available_in_card_currency?: CardCurrencyAmount;
}): { label: string; amount: number; currency: string; usdEquivalent?: number } | undefined => {
  const inCard = cardCurrencyFigure(balances?.available_in_card_currency);
  if (!inCard) return undefined;

  const usd = Number(balances?.available?.amount);
  return {
    label: formatCardCurrency(inCard.amount, inCard.currency),
    amount: inCard.amount,
    currency: inCard.currency,
    ...(Number.isFinite(usd) && { usdEquivalent: usd }),
  };
};

/**
 * A shortfall rounded up to the next 5 — €18.75 becomes €20, €0.07 becomes €5.
 *
 * What the fix buttons offer: the exact gap would leave the next payment as
 * tight as this one, and "Swap €18.75 of ETH" reads like a figure to type, not a
 * fix to tap.
 */
export const roundUpShortfall = (shortfall: number): number => {
  if (!Number.isFinite(shortfall) || shortfall <= 0) return 0;
  return Math.ceil(Number((shortfall / 5).toFixed(6))) * 5;
};

/** The two figures the declined receipt sets side by side, and what follows from them. */
export interface DeclinedPaymentFigures {
  /** What the till asked for — in the currency Wirex billed it, when we know it. */
  payment: Money;
  /** What the card can spend now, live. Absent until the balance has been read. */
  available?: Money;
  /**
   * The two in one currency, when they can be compared: the card's own when it
   * is the payment's, otherwise dollars. Absent when no common figure exists.
   */
  comparable?: {
    payment: number;
    available: number;
    currency: string;
    /** USD per one unit of `currency`, to size a swap or a top-up in dollars. */
    rateToUsd: number;
  };
  /** In Smart mode, the cash path may need a larger top-up than the credit shortfall. */
  cashComparable?: DeclinedPaymentFigures['comparable'];
}

type DeclinedPayment = Pick<CardTransaction, 'amount' | 'currency' | 'usd_amount'> & {
  spend_details?: Pick<CardSpendDetails, 'card_amount' | 'card_currency' | 'usd_amount'>;
};

interface DeclineCreditAvailability {
  mode: 'credit' | 'smart';
  availableUsd?: number;
  displayUsdPerEur?: number;
  /**
   * `availableUsd` is the home Available to spend tile's own number — in Smart, already the larger
   * of cash and credit — so it is quoted as it is rather than weighed against the cash path again.
   */
  isTileFigure?: boolean;
}

/**
 * The payment that was declined and what the card can spend now, in figures that
 * can be compared — the data behind "Not enough to pay".
 *
 * ## Which payment figure
 *
 * Our ledger's `card_amount` when the receipt has it: that is what Wirex billed
 * the card, in the card's currency, and so what the balance has to cover. The
 * receipt total is the merchant's own figure and can be in anything (a BRL shop
 * billed to a euro card), so it is only the fallback.
 *
 * ## Which common currency
 *
 * The card's own when the payment was billed in it — the usual case, and the one
 * the design draws (€18.75 against €0.00). Dollars when the payment was in
 * dollars, or when only a dollar value of it is known.
 */
const cashPaymentFigures = (
  transaction: DeclinedPayment,
  spendable?: CardSpendableResponse | null,
): DeclinedPaymentFigures => {
  const billed = Number(transaction.spend_details?.card_amount);
  const billedCurrency = transaction.spend_details?.card_currency?.trim().toUpperCase();
  const payment: Money =
    billedCurrency && Number.isFinite(billed) && billed > 0
      ? { amount: billed, currency: billedCurrency }
      : {
          amount: Math.abs(Number(transaction.amount) || 0),
          currency: transaction.currency?.trim().toUpperCase() || 'USD',
        };

  if (!spendable) return { payment };

  const usd = Number(spendable.available?.amount);
  const usdAvailable = Number.isFinite(usd) ? usd : 0;
  const inCard = cardCurrencyFigure(spendable.available_in_card_currency);
  const rate = spendable.available_in_card_currency?.rate;

  // The design's case: both in the card's own currency.
  if (inCard && inCard.currency === payment.currency && rate && rate > 0) {
    return {
      payment,
      available: inCard,
      comparable: {
        payment: payment.amount,
        available: inCard.amount,
        currency: inCard.currency,
        rateToUsd: rate,
      },
    };
  }

  const available: Money = inCard ?? { amount: usdAvailable, currency: 'USD' };

  if (payment.currency === 'USD') {
    return {
      payment,
      available: { amount: usdAvailable, currency: 'USD' },
      comparable: {
        payment: payment.amount,
        available: usdAvailable,
        currency: 'USD',
        rateToUsd: 1,
      },
    };
  }

  // Billed in something the balance is not shown in: compare the dollar values.
  const paymentUsd = Number(transaction.spend_details?.usd_amount ?? transaction.usd_amount);
  if (Number.isFinite(paymentUsd) && paymentUsd > 0) {
    return {
      payment,
      available,
      comparable: {
        payment: paymentUsd,
        available: usdAvailable,
        currency: 'USD',
        rateToUsd: 1,
      },
    };
  }

  return { payment, available };
};

/**
 * The backend's spendable figures with the home Available to spend tile's number in their place.
 *
 * The backend counts cash only. The tile follows the spend mode, so in Credit it counts the credit
 * line too — and the declined-payment banner under it said "You have €10.02 available to spend"
 * beside a tile reading €36.54. The banner and the receipt take this, so all three quote one
 * number.
 *
 * For the cash path. In Credit and Smart the tile's number goes to `declinedPaymentFigures` as the
 * credit figure instead (`isTileFigure`).
 *
 * `usd` is the tile's figure in dollars. `eur` is what the tile shows when it shows euros: used as
 * it is for a euro card, so the two match to the cent; otherwise the dollars are converted at the
 * card's own quote and rounded down, as the backend's figure is. The quote itself is kept.
 */
export const withTileAvailable = (
  spendable: CardSpendableResponse,
  tile: { usd: number; eur?: number },
): CardSpendableResponse => {
  const usd = Math.max(0, tile.usd);
  const inCard = spendable.available_in_card_currency;
  const rate = inCard?.rate;
  const isEuroCard = inCard?.currency?.trim().toUpperCase() === 'EUR';
  const inCardAmount =
    isEuroCard && tile.eur !== undefined
      ? Math.max(0, tile.eur)
      : rate && rate > 0
        ? usdToEur(usd, rate)
        : undefined;

  return {
    ...spendable,
    available: { amount: String(usd), currency: 'usd' },
    // Without a usable quote there is no figure in the card's currency to give: dollars it is.
    available_in_card_currency:
      inCard && inCardAmount !== undefined
        ? { ...inCard, amount: inCardAmount.toFixed(2) }
        : undefined,
  };
};

export const declinedPaymentFigures = (
  transaction: DeclinedPayment,
  spendable?: CardSpendableResponse | null,
  credit?: DeclineCreditAvailability,
): DeclinedPaymentFigures => {
  const cash = cashPaymentFigures(transaction, spendable);
  if (!credit) return cash;

  const { payment } = cash;
  const { availableUsd, displayUsdPerEur } = credit;
  if (availableUsd === undefined) {
    return credit.mode === 'smart' ? { ...cash, cashComparable: cash.comparable } : { payment };
  }

  const available: Money = displayUsdPerEur
    ? { amount: usdToEur(availableUsd, displayUsdPerEur), currency: 'EUR' }
    : { amount: availableUsd, currency: 'USD' };
  const recordedUsd = Math.abs(
    Number(transaction.spend_details?.usd_amount ?? transaction.usd_amount),
  );
  const paymentUsd =
    payment.currency === 'USD'
      ? payment.amount
      : Number.isFinite(recordedUsd) && recordedUsd > 0
        ? recordedUsd
        : cash.comparable && cash.comparable.payment * cash.comparable.rateToUsd;
  const comparable = paymentUsd
    ? { payment: paymentUsd, available: availableUsd, currency: 'USD', rateToUsd: 1 }
    : undefined;

  if (credit.mode === 'credit') return { payment, available, comparable };
  // The tile's Smart number: one figure for the banner, the receipt and the tile. A top-up still
  // funds the cash path, so the cash comparison stays beside it.
  if (credit.isTileFigure) {
    return { payment, available, comparable, cashComparable: cash.comparable };
  }

  // Smart can use either path. Compare the gaps in USD, since the two paths can use different FX.
  const cashUsd = Number(spendable?.available?.amount);
  const cashMarginUsd = cash.comparable
    ? (cash.comparable.available - cash.comparable.payment) * cash.comparable.rateToUsd
    : undefined;
  const preferCredit =
    comparable && cashMarginUsd !== undefined
      ? comparable.available - comparable.payment > cashMarginUsd
      : !Number.isFinite(cashUsd) || availableUsd > cashUsd;
  return preferCredit
    ? { payment, available, comparable, cashComparable: cash.comparable }
    : { ...cash, cashComparable: cash.comparable };
};

/** Up to the cent: the gap is never under-stated. */
export const shortfallOf = (comparable: NonNullable<DeclinedPaymentFigures['comparable']>) =>
  Math.max(
    0,
    Math.ceil(Number(((comparable.payment - comparable.available) * 100).toFixed(6))) / 100,
  );

/**
 * The action a declined receipt leads with. Cash actions can also appear in a decline push.
 */
export type DeclineFix = 'turn_on_euro' | 'turn_on_base' | 'swap' | 'add_funds' | 'view_spend_mode';

/** Below this a holding is dust, not a fix — the swap form's own floor. */
const MIN_SWAP_VALUE_USD = 1;

/**
 * Which fix the receipt offers, first match wins — the order the decline push uses.
 *
 *  1. **Turn on euro spending**: a euro payment their EURC on Base covers in full. One purchase
 *     draws from one balance, so EURC short of the payment would decline again once turned on.
 *  2. **Turn on Base**: any payment their other Base holdings — USDC, USDT, crypto — cover in
 *     full, for the same reason. Ahead of a swap because it costs no swap fee and moves nothing.
 *  3. **Swap**: their richest "Swap first" holding, when it is worth the gap. The swap lands as
 *     USDC on Fuse, which the card spends straight away.
 *  4. **Add funds**, which is never wrong.
 */
export const chooseDeclineFix = ({
  payment,
  merchantCurrency,
  unusableEurc,
  unreachableBaseUsd = 0,
  paymentUsd,
  swapValueUsd,
  shortfallUsd,
}: {
  payment: Money;
  /** The currency the merchant charged in — the receipt's own `currency`. */
  merchantCurrency?: string;
  /** EURC on Base the card cannot reach yet; 0 once euro spending is on. */
  unusableEurc: number;
  /** USD value of the non-euro holdings on Base the card cannot reach yet; 0 once Base is on. */
  unreachableBaseUsd?: number;
  /** The whole payment in dollars, when it is known. */
  paymentUsd?: number;
  /** USD value of the richest swappable holding, if any. */
  swapValueUsd?: number;
  /** The gap in dollars, when it is known. */
  shortfallUsd?: number;
}): DeclineFix => {
  const euroPayment =
    payment.currency === 'EUR' && merchantCurrency?.trim().toUpperCase() === 'EUR';
  if (euroPayment && unusableEurc > 0 && unusableEurc >= payment.amount) return 'turn_on_euro';

  if (paymentUsd !== undefined && unreachableBaseUsd > 0 && unreachableBaseUsd >= paymentUsd) {
    return 'turn_on_base';
  }

  if (
    swapValueUsd !== undefined &&
    swapValueUsd >= Math.max(shortfallUsd ?? 0, MIN_SWAP_VALUE_USD)
  ) {
    return 'swap';
  }

  return 'add_funds';
};

/** "€211.45", and "€211" for a round figure — the same shape `formatUsd` gives dollars. */
export const formatEur = (euros: number): string => {
  const fractionDigits = Number.isInteger(euros) ? 0 : 2;
  return euros.toLocaleString('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

/**
 * Dollars to euros at the card's EURC price, rounded down to the cent: a balance shown in euros
 * must not promise a cent the card cannot pay, the rule the backend's euro figure follows too.
 */
export const usdToEur = (usd: number, usdPerEur: number): number =>
  Math.floor((usd / usdPerEur) * 100 + 1e-9) / 100;
