import { CardProvider, Cashback, CashbackInfo, CashbackStatus } from '@/lib/types';

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
export const getColorForTransaction = (
  merchantName: string,
): { bg: string; text: string } => {
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
 * Normalize amount for display: Rain returns cents, Bridge returns dollars.
 */
function normalizeCardAmount(amount: string, provider?: CardProvider | null): number {
  const num = parseFloat(amount);
  if (provider === CardProvider.RAIN) return num / 100;
  return num;
}

/**
 * Format card transaction amount with proper sign and currency symbol.
 * Pass provider so Rain amounts (cents) are converted to dollars for display.
 */
export const formatCardAmount = (
  amount: string,
  provider?: CardProvider | null,
): string => {
  const numAmount = normalizeCardAmount(amount, provider);
  const sign = numAmount >= 0 ? '' : '-';
  return `${sign}$${Math.abs(numAmount).toFixed(2)}`;
};

/**
 * Format card transaction amount with currency code and +/- sign.
 * Pass provider so Rain amounts (cents) are converted to dollars for display.
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

  // For pending cashbacks without fuseAmount yet, show pending indicator without amount
  if (!cashback.fuseAmount) {
    return {
      amount: 'Pending',
      isPending: true,
    };
  }

  const fuseAmountAsNum = parseFloat(cashback.fuseAmount);
  const fuseUsdPriceAsNum = parseFloat(cashback.fuseUsdPrice || '0');
  const amount = fuseAmountAsNum * fuseUsdPriceAsNum;

  if (isNaN(amount) || amount <= 0) {
    return null;
  }

  return {
    amount: `+$${amount.toFixed(2)}`,
    isPending,
  };
};
