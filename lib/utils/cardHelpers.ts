import {
  CardProvider,
  CardResponse,
  CardStatus,
  Cashback,
  CashbackInfo,
  CashbackStatus,
  FreezeInitiator,
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
 * Format card transaction amount with proper sign and currency symbol.
 */
export const formatCardAmount = (amount: string, provider?: CardProvider | null): string => {
  const numAmount = normalizeCardAmount(amount, provider);
  const sign = numAmount >= 0 ? '' : '-';
  return `${sign}$${Math.abs(numAmount).toFixed(2)}`;
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

  // For pending cashbacks without a payout amount yet, show pending indicator
  // without an amount. New cashbacks carry soUsdAmount; pre-migration ones
  // carry the legacy fuseAmount.
  const soUsdAmount = cashback.soUsdAmount;
  const legacyFuseAmount = cashback.fuseAmount;

  if (!soUsdAmount && !legacyFuseAmount) {
    return {
      amount: 'Pending',
      isPending: true,
      isEscrowed,
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
    amount: `+$${amount.toFixed(2)}`,
    isPending,
    isEscrowed,
    payoutAt: cashback.payoutAt,
  };
};
