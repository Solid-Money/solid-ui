import { formatUsdShort } from '@/lib/referral/referralV4';
import { ReferralSummary } from '@/lib/types';

/**
 * The one line the referral cashback screen shows while the user owes back
 * rewards reversed after they were paid — the friend refunded the purchases
 * that qualified them. Only what is still owed is known, so the rewards
 * themselves go unpriced. Null when nothing is owed.
 *
 * It is taken out of their next referral rewards, never out of their wallet,
 * which is what the line has to make clear: the money they already have stays
 * where it is.
 */
export const cashbackDebtLine = (debt: ReferralSummary['debt']): string | null => {
  if (!debt || !(debt.remainingUsd > 0)) return null;
  const count = Math.max(1, Math.round(debt.reversedCount || 0));
  const reversed =
    count === 1
      ? 'A reward you were paid was reversed because the qualifying purchases were refunded.'
      : `${count} rewards you were paid were reversed because the qualifying purchases were refunded.`;
  return `${reversed} ${formatUsdShort(debt.remainingUsd)} will come out of your next referral rewards.`;
};
