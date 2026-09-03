import {
  CardCollateralTokenBalanceDto,
  CardFeeInfo,
  CardFeeStatus,
  CardFeeWaiveReason,
  CardProvider,
  CardResponse,
  CardSpendDetails,
  CardStatus,
  CardTransaction,
  CardTransactionFee,
  Cashback,
  CashbackInfo,
  CashbackStatus,
  CryptoTransactionDetails,
  FreezeInitiator,
  KycStatus,
} from '@/lib/types';

/** The freeze fields every card surface reads, so callers can pass a partial. */
type FreezeState = Pick<CardResponse, 'status' | 'freezes'> | undefined | null;

/**
 * Whether the cardholder may lift the freeze that's currently on their card.
 *
 * `freezes` is the only signal for this, and it doesn't mean the same thing on
 * every issuer: Bridge returns the provider's own records, while Rain and Wirex
 * return none and the backend synthesises an entry from our card row. Both
 * converge on one rule — a frozen card carries an entry naming who froze it, and
 * only the customer's own freeze may be lifted from the app. A provider freeze
 * (compliance, suspected fraud) has to go through support.
 *
 * An empty list on a frozen card is not permission: it means nothing is on file,
 * so treat it as somebody else's freeze.
 */
const canCustomerUnfreezeCard = (cardDetails: FreezeState): boolean => {
  if (cardDetails?.status !== CardStatus.FROZEN) return false;
  return !!cardDetails.freezes?.some(freeze => freeze.initiator === FreezeInitiator.CUSTOMER);
};

/**
 * Whether to offer the freeze toggle at all. Freezing is always available on a
 * live card; unfreezing only when the customer's own freeze is what's in place.
 *
 * Shared by the card pane and the desktop header — when the two derived it
 * separately, a fix to one silently left the other showing a different set of
 * actions for the same card.
 */
export const canToggleCardFreeze = (cardDetails: FreezeState): boolean =>
  cardDetails?.status !== CardStatus.FROZEN || canCustomerUnfreezeCard(cardDetails);

/**
 * KYC states where we move no money for the customer in either direction.
 *
 * Paused and offboarded are holds on the person rather than on the card, so they
 * are the one thing that stops a withdrawal too — a card-level problem doesn't.
 * Anything else, an unresolved status included, leaves both actions offered.
 *
 * Takes a bare string because that is what `/bridge-customer` is typed as: the
 * endpoint passes Bridge's status through unmodelled, and only the two values
 * named here are acted on, so an unrecognised one restricts nothing.
 */
export const isCustomerFundsRestricted = (status: string | undefined | null): boolean =>
  status === KycStatus.PAUSED || status === KycStatus.OFFBOARDED;

/** What the card action row needs to know before offering to move money. */
export interface CardFundsAccess {
  /** The card is frozen — by the cardholder or by the provider. */
  isCardFrozen: boolean;
  /** KYC is paused or the customer is offboarded — see `isCustomerFundsRestricted`. */
  isCustomerRestricted: boolean;
}

/**
 * Whether to offer Add funds.
 *
 * A frozen card cannot spend, so a deposit onto one only moves the user's
 * balance somewhere it does less for them. The action waits for the unfreeze.
 */
export const canAddFundsToCard = ({
  isCardFrozen,
  isCustomerRestricted,
}: CardFundsAccess): boolean => !isCardFrozen && !isCustomerRestricted;

/**
 * Whether to offer Withdraw. Deliberately does **not** read `isCardFrozen`.
 *
 * Withdrawing used to be gated with Add funds on one `canMoveCardFunds` flag,
 * which read as symmetric and isn't. A freeze stops the card spending; it does
 * not touch the collateral, and a Rain withdrawal doesn't go through the card at
 * all — it moves tokens out of the collateral proxy, which Rain signs for a
 * frozen card exactly as it does for a live one. Our own withdraw endpoints
 * carry no card-status check either. So hiding the button withheld an action
 * that was available the whole time, from the users most likely to want it: a
 * card frozen for suspected fraud, or one the cardholder froze precisely because
 * they were done with it and wanted their money back.
 *
 * A provider freeze is treated the same as the customer's own here. Unlike
 * unfreezing — which would undo a compliance hold and so has to go through
 * support — taking collateral out is not a way around the freeze, and the API
 * permits it either way; hiding the button would only hide it from the app.
 */
export const canWithdrawFromCard = ({ isCustomerRestricted }: CardFundsAccess): boolean =>
  !isCustomerRestricted;

/**
 * Whether this card can be funded by depositing onto it.
 *
 * Rain cards are prefunded — the user moves soUSD onto the card and spends the
 * balance sitting there. Wirex cards under External Authorization have no balance
 * of their own: Wirex pays the merchant from its own Master Account and our backend
 * debits the user's Safe on settlement. So a deposit to a Wirex card has no
 * destination, and every "Add funds" entry point (the card action row, the wallet's
 * balance breakdown, the wallet action bar) has to agree about that.
 *
 * A Wirex cardholder registers their Safe with `SolidCashModule` instead — see
 * `useCardSpendRegistration`. Their savings balance IS their card balance.
 *
 * `null`/`undefined` means the issuer is not resolved yet; deposits are offered by
 * default so a Rain cardholder never loses the action to a slow query.
 */
export const canDepositToCard = (provider: CardProvider | null | undefined): boolean =>
  provider !== CardProvider.WIREX;

/**
 * Whether the card carries a balance of its own, i.e. one that belongs in a total
 * of what the user holds.
 *
 * Delegates to {@link canDepositToCard} rather than repeating the rule, because it
 * is the same rule: a card you can deposit into is a prefunded card, and a
 * prefunded card is the only kind with money of its own. It gets its own name
 * because the callers ask different questions — one whether to offer a deposit,
 * this one whether the figure is a separate pot or a view onto savings.
 *
 * That distinction is what keeps the home total honest. A Wirex card's reported
 * "balance" is spendable soUSD, which is savings seen from the card's side, so
 * adding it to savings counts the same money twice.
 */
export const cardHoldsBalance = (provider: CardProvider | null | undefined): boolean =>
  canDepositToCard(provider);

/**
 * Get initials from merchant/person name for avatar display
 */
export const getInitials = (name: string): string => {
  if (!name) return '?';
  const words = name.split(' ');
  if (words.length === 1) return name.substring(0, 2).toUpperCase();
  return (words[0][0] + (words[1]?.[0] || '')).toUpperCase();
};

/**
 * Get a consistent avatar color based on name hash
 */
export const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-[#5B7C8D]', // teal/blue
    'bg-[#8B5A5A]', // red/brown
    'bg-[#6B5B8B]', // purple
    'bg-[#8B7A5A]', // brown/tan
    'bg-[#5A8B6B]', // green
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

/**
 * Get a consistent color palette for transaction merchant icons
 * Returns background and text colors based on merchant name hash
 */
export const getColorForTransaction = (merchantName: string): { bg: string; text: string } => {
  const colors = [
    { bg: 'rgba(127,230,242,0.25)', text: '#7fe6f2' }, // cyan
    { bg: 'rgba(242,127,129,0.25)', text: '#f27f81' }, // red
    { bg: 'rgba(165,127,242,0.25)', text: '#a57ff2' }, // purple
    { bg: 'rgba(242,194,127,0.25)', text: '#f2c27f' }, // orange
    { bg: 'rgba(127,242,158,0.25)', text: '#7ff29e' }, // green
    { bg: 'rgba(242,127,215,0.25)', text: '#f27fd7' }, // pink
  ];

  let hash = 0;
  for (let i = 0; i < merchantName.length; i++) {
    hash = merchantName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

/**
 * What to call a card transaction in a list. The merchant is the name the user
 * recognises; the issuer's own description stands in for the rows that have no
 * merchant (funding, adjustments).
 */
export const getCardMerchantName = (
  transaction: Pick<CardTransaction, 'merchant_name' | 'description'>,
): string => transaction.merchant_name || transaction.description || 'Unknown';

/**
 * Where the card was used, as one line.
 *
 * City/country when the issuer breaks the address up (Rain), else the single
 * address line Wirex sends — without the fallback a Wirex row loses its location
 * entirely.
 */
export const getCardMerchantLocation = (
  transaction: Pick<CardTransaction, 'merchant_city' | 'merchant_country' | 'merchant_location'>,
): string | undefined =>
  [transaction.merchant_city, transaction.merchant_country].filter(Boolean).join(' ') ||
  transaction.merchant_location ||
  undefined;

/** Where a card was used, split into what the row shows and what a map needs. */
export interface CardMerchantPlace {
  /** "TEL AVIV, IL" — the city and country, and nothing else. */
  label: string;
  /** The fullest address on file, which is what the map is asked to find. */
  address: string;
}

/**
 * The Location row on a transaction's details: a short "TEL AVIV, IL" line that
 * opens the full address in a map.
 *
 * The two are separate because the issuers send different things. Rain breaks the
 * address into `merchant_city`/`merchant_country`; Wirex sends one address line
 * plus the country, and the backend splits its city out of that line. The row
 * shows city and country alone — a full street address wraps to three lines and
 * tells the user nothing they didn't already know about their own purchase — but
 * the street is exactly what makes the map land on the right place, so it is kept
 * for the tap.
 *
 * Falls back to the address line when there is no city, rather than showing
 * nothing: a row without a resolved city is still worth more than a blank.
 */
export const getCardMerchantPlace = (
  transaction: Pick<CardTransaction, 'merchant_city' | 'merchant_country' | 'merchant_location'>,
): CardMerchantPlace | undefined => {
  const address = transaction.merchant_location?.trim();
  const label =
    [transaction.merchant_city?.trim(), transaction.merchant_country?.trim()]
      .filter(Boolean)
      .join(', ') || address;

  if (!label) return undefined;

  return { label: label.toUpperCase(), address: address || label };
};

/**
 * A Google Maps search for where the card was used.
 *
 * The merchant's name leads the query. An address alone drops the user on a
 * street rather than on the business they are looking at, and for the city-only
 * addresses Rain sends it would drop them on the city centre — whereas
 * "mb burger, TEL AVIV, IL" finds the shop. Maps' universal cross-platform URL is
 * used so the same link opens the app on a phone and the site on the web.
 */
export const getCardMerchantMapsUrl = (place: CardMerchantPlace, merchantName?: string): string => {
  const query = [merchantName?.trim(), place.address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

/**
 * Normalize amount for display.
 * Both Rain and Bridge amounts are returned as dollars from the backend.
 */
function normalizeCardAmount(amount: string, provider?: CardProvider | null): number {
  return parseFloat(amount);
}

/**
 * A balance turned into a plain numeric string an amount input can hold,
 * floored to the cent.
 *
 * `formatNumber` is for display only — it groups thousands ("1,234.56"), and
 * feeding that back into the field makes `Number()` NaN, so a "Max" press on a
 * balance over $1,000 failed validation. Flooring rather than rounding keeps
 * Max at or below the real balance: a maximum rounded a fraction of a cent
 * upwards is a withdrawal the provider rejects.
 */
export const toAmountInputValue = (amount: number): string => {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  return (Math.floor(amount * 100) / 100).toFixed(2);
};

/**
 * How a collateral asset is named in the UI: "USDC" when the chain answered
 * `symbol()`, else a short address.
 *
 * This lives here, platform-neutral, rather than beside the selector that first
 * needed it. It used to be exported from `ToDestinationSelector.web.tsx`, which
 * the native selector imported but never re-exported — so on iOS/Android
 * `import { assetLabel } from '.../ToDestinationSelector'` resolved to the
 * `.native` file and produced `undefined`. Calling it then threw "undefined is
 * not a function" from inside a render, taking the whole app to the error
 * boundary. A helper every platform shares has no business hanging off a
 * platform-specific module.
 */
export const assetLabel = (asset: CardCollateralTokenBalanceDto): string =>
  asset.symbol || `${asset.tokenAddress.slice(0, 6)}…${asset.tokenAddress.slice(-4)}`;

/**
 * Block explorer for the chain a card transaction settled on.
 *
 * Rain settles on Arbitrum and Wirex on Base, so the explorer has to follow the
 * transaction rather than being fixed — an Arbiscan link for a Base hash opens a
 * page saying the transaction does not exist, which reads as lost money.
 * Arbitrum stays the fallback: it is where every card transaction that predates
 * the `chain` field came from.
 */
export const cardTransactionExplorerUrl = (
  details: CryptoTransactionDetails | undefined,
): string | undefined => {
  const hash = details?.tx_hash;
  if (!hash) return undefined;

  switch (details?.chain?.toLowerCase()) {
    case 'base':
      return `https://basescan.org/tx/${hash}`;
    case 'base-sepolia':
    case 'basesepolia':
      return `https://sepolia.basescan.org/tx/${hash}`;
    default:
      return `https://arbiscan.io/tx/${hash}`;
  }
};

/** Fuse — the only chain the soUSD sweep runs on. */
const FUSE_CHAIN_ID = 122;

/**
 * Explorer link for the soUSD sweep that funded a card transaction.
 *
 * Kept apart from {@link cardTransactionExplorerUrl}: that one links the issuer's
 * own on-chain leg, this one links ours, and for the same purchase they are on
 * different chains. An unrecognised chain returns nothing rather than guessing —
 * a link to the wrong explorer is worse than no link, because it renders as a
 * transaction that does not exist.
 */
export const cardSweepExplorerUrl = (details: CardSpendDetails | undefined): string | undefined => {
  const hash = details?.sweep_tx_hash;
  if (!hash) return undefined;
  // The backend sends the chain alongside the hash; tolerate its absence rather
  // than dropping the link, since Fuse is the only chain that produces one.
  const chainId = details?.chain_id ?? FUSE_CHAIN_ID;
  if (chainId !== FUSE_CHAIN_ID) return undefined;
  return `https://explorer.fuse.io/tx/${hash}`;
};

/**
 * Currencies that read better as a leading symbol. Deliberately short: anything
 * missing falls back to a trailing ISO code, which is how CHF and PLN are
 * written anyway, and is honest rather than wrong — Rain cards are USD, but a
 * Wirex card settles in whatever the merchant charged.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
};

/**
 * Format card transaction amount with proper sign and currency symbol.
 *
 * `currency` is optional and defaults to dollars, because that is what every
 * Rain and Bridge card is denominated in and what every existing caller assumed.
 * Pass the transaction's own currency for issuers that are not USD-only:
 * a €50 Wirex purchase rendered as "$50.00" is not a formatting nit, it is the
 * wrong number.
 */
export const formatCardAmount = (
  amount: string,
  provider?: CardProvider | null,
  currency?: string,
): string => {
  const numAmount = normalizeCardAmount(amount, provider);
  const sign = numAmount >= 0 ? '' : '-';
  const value = Math.abs(numAmount).toFixed(2);
  const code = currency?.trim().toUpperCase();

  // Only a three-letter ISO code is treated as a currency. The same field also
  // carries token symbols on crypto funding rows ("usdc"), and those are already
  // dollar-denominated 1:1 — rendering them as "50.00 USDC" would change how
  // every existing Rain and Bridge row reads for no gain.
  if (!code || !/^[A-Z]{3}$/.test(code)) return `${sign}$${value}`;

  const symbol = CURRENCY_SYMBOLS[code];
  // Unknown code goes after the number ("-12.34 SEK"): an unfamiliar symbol
  // glued to the front reads as part of the figure.
  return symbol ? `${sign}${symbol}${value}` : `${sign}${value} ${code}`;
};

/**
 * Whether a card transaction took money from the cardholder.
 *
 * The stored sign is the ledger's, not the reader's: both issuers record a debit
 * as positive and a credit as negative (see `mapWirexActivityToCardTransaction`,
 * which says so explicitly and matches Rain). A statement reads the other way
 * round — a purchase is money gone — so `transaction.amount` should never go
 * through {@link formatCardAmount} and straight onto the screen.
 *
 * An unparseable amount counts as outgoing. Card rows are overwhelmingly
 * purchases, and a purchase missing its minus reads as a credit the user never
 * received, which is the worse of the two mistakes.
 */
export const isOutgoingCardTransaction = (transaction: Pick<CardTransaction, 'amount'>): boolean =>
  !(parseFloat(transaction.amount) < 0);

/**
 * A figure belonging to a card transaction, signed the way the cardholder reads
 * it: what the card spent carries a minus, what came back a plus.
 *
 * Direction comes in as a flag rather than being re-derived from `amount`,
 * because the figure being formatted is not always the one carrying the sign —
 * the dollar equivalent of a foreign charge is stored unsigned and has to follow
 * the charge it converts.
 *
 * Zero gets no sign: "-$0.00" reads as a rounding bug rather than as a
 * transaction that moved nothing.
 */
export const formatCardTransactionAmount = (
  amount: string,
  isOutgoing: boolean,
  provider?: CardProvider | null,
  currency?: string,
): string => {
  const magnitude = Math.abs(parseFloat(amount));
  // Formatted from the magnitude, so `formatCardAmount`'s own leading "-" on a
  // negative input cannot collide with the sign chosen here.
  const formatted = formatCardAmount(
    Number.isFinite(magnitude) ? magnitude.toString() : amount,
    provider,
    currency,
  );

  if (!magnitude) return formatted;

  return `${isOutgoing ? '-' : '+'}${formatted}`;
};

/**
 * Format card transaction amount with currency code and +/- sign.
 */
export const formatCardAmountWithCurrency = (
  amount: string,
  currency: string,
  provider?: CardProvider | null,
): string => {
  const numAmount = normalizeCardAmount(amount, provider);
  return `${numAmount >= 0 ? '+' : ''}${numAmount.toFixed(2)} ${currency.toUpperCase()}`;
};

// Statuses that should display cashback UI
const VISIBLE_CASHBACK_STATUSES: CashbackStatus[] = [
  CashbackStatus.Paid,
  CashbackStatus.Escrowed,
  CashbackStatus.Pending,
];

// Statuses that indicate cashback is still pending
const PENDING_CASHBACK_STATUSES: CashbackStatus[] = [
  CashbackStatus.Escrowed,
  CashbackStatus.Pending,
];

/** "+$5.77", or null when there is no positive figure worth printing. */
const formatCashbackAmount = (value: number | undefined): string | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? `+$${value.toFixed(2)}` : null;

/**
 * Get cashback info for a transaction
 * @param transactionId - The card transaction ID
 * @param cashbacks - Array of cashback records
 * @returns CashbackInfo object with amount and pending status, or null if no valid cashback
 */
export const getCashbackAmount = (
  transactionId: string,
  cashbacks: Cashback[] | undefined,
): CashbackInfo | null => {
  if (!cashbacks) return null;

  const cashback = cashbacks.find(cb => cb.transactionId === transactionId);

  if (!cashback) {
    return null;
  }

  // Only show cashback for Paid, Escrowed, or Pending statuses
  if (!VISIBLE_CASHBACK_STATUSES.includes(cashback.status)) {
    return null;
  }

  const isPending = PENDING_CASHBACK_STATUSES.includes(cashback.status);
  const isEscrowed = cashback.status === CashbackStatus.Escrowed;

  // New cashbacks carry soUsdAmount; pre-migration ones carry the legacy
  // fuseAmount. Neither is written until the escrow matures.
  const soUsdAmount = cashback.soUsdAmount;
  const legacyFuseAmount = cashback.fuseAmount;

  if (!soUsdAmount && !legacyFuseAmount) {
    // Nothing has been paid yet, so the figure is the backend's projection of
    // what this purchase will earn — which is the whole point of showing it
    // here, on the day of the purchase rather than a fortnight later. A backend
    // that sends no projection leaves the amount null and the surface names the
    // status instead.
    return {
      amount: formatCashbackAmount(cashback.projectedUsdValue),
      isPending: true,
      isEscrowed,
      isPaid: false,
      payoutAt: cashback.payoutAt,
    };
  }

  // USD value = token amount × its USD rate. soUSD uses soUsdRate (USD per
  // share); legacy FUSE cashbacks use fuseUsdPrice.
  const tokenAmount = soUsdAmount ?? legacyFuseAmount ?? '0';
  const usdRate = soUsdAmount ? cashback.soUsdRate : cashback.fuseUsdPrice;
  const amount = parseFloat(tokenAmount) * parseFloat(usdRate || '0');

  if (isNaN(amount) || amount <= 0) {
    return null;
  }

  return {
    amount: formatCashbackAmount(amount),
    isPending,
    isEscrowed,
    isPaid: cashback.status === CashbackStatus.Paid,
    payoutAt: cashback.payoutAt,
  };
};

/** Tier key → the name the user sees on the tier screen. */
const TIER_LABELS: Record<string, string> = {
  core: 'Core',
  prime: 'Prime',
  ultra: 'Ultra',
};

/** Fee statuses where the charge has not landed yet but is still owed. */
const PENDING_FEE_STATUSES: string[] = [CardFeeStatus.Pending, CardFeeStatus.Failed];

/**
 * A fee fraction as display copy: 0.0099 → "0.99%", 0.005 → "0.5%".
 * Trailing zeros are trimmed so a round rate doesn't read as "0.50%".
 */
export const formatCardFeeRate = (percentage: number): string => {
  if (!Number.isFinite(percentage) || percentage <= 0) return '';
  return `${Number((percentage * 100).toFixed(2))}%`;
};

/**
 * The fee to show on a card transaction, or null when there's nothing to say.
 *
 * A transaction carries at most one fee today (FX on a converted purchase), but
 * the API returns a list, so the largest charged fee wins and a waived one is
 * only shown when nothing was actually charged. That ordering matters: a user
 * looking at a receipt wants to see what they paid first, and what they didn't
 * pay second.
 *
 * A fee that failed still shows: the retry will move their balance, so the
 * receipt should already say the fee is owed rather than appear to change later.
 * A fee waived because the program is switched off shows nothing at all — that
 * is our configuration, not a benefit the user earned.
 */
export const getCardFeeInfo = (transaction: Pick<CardTransaction, 'fees'>): CardFeeInfo | null => {
  const fees = transaction.fees;
  if (!fees?.length) return null;

  const charged = fees
    .filter(fee => !isWaivedFee(fee) && parseFloat(fee.amount) > 0)
    .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

  if (charged.length > 0) {
    const fee = charged[0];
    return {
      amount: `-$${parseFloat(fee.amount).toFixed(2)}`,
      label: fee.label,
      isWaived: false,
      isPending: PENDING_FEE_STATUSES.includes(fee.status),
      rate: formatCardFeeRate(fee.percentage),
    };
  }

  // Nothing charged: surface the tier benefit, but only when the tier is what
  // earned it. "Disabled" means we haven't launched the fee, which is not news.
  const earned = fees.find(fee => fee.waive_reason === CardFeeWaiveReason.TierFree);
  if (!earned) return null;

  const tierLabel = TIER_LABELS[earned.tier];

  return {
    amount: 'Free',
    label: earned.label,
    isWaived: true,
    isPending: false,
    rate: '',
    waivedNote: tierLabel ? `Waived on ${tierLabel}` : 'Waived',
  };
};

const isWaivedFee = (fee: CardTransactionFee): boolean => fee.status === CardFeeStatus.Waived;
