import { isPreviewYieldKey } from '@/components/Card/OrderList/previewAssets';

import type { CardCollateralOrderPreviewResponse } from '@/lib/types';

/**
 * A token amount off the wire ("0.00123456"): four decimals from one up, four significant digits
 * under it, so a satoshi-sized lock does not read as "0". Left as sent if it is not a number.
 */
export const formatLockedAmount = (amount: string): string => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return value >= 1 || value === 0
    ? value.toLocaleString('en-US', { maximumFractionDigits: 4 })
    : value.toLocaleString('en-US', { maximumSignificantDigits: 4 });
};

const money = (amount: number): string =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * The line under the breakdown. A shortfall first; then, with nothing new to lock, what covers it
 * (card bonus, collateral already locked, or both); otherwise that locking is not selling — and
 * that it keeps earning, only when every line is a yield share (Bitcoin locked earns nothing) —
 * after any card bonus that pays first.
 */
export const collateralPreviewFootnote = (
  preview: Pick<
    CardCollateralOrderPreviewResponse,
    'covered' | 'lines' | 'amount_usd' | 'card_credit_usd'
  >,
): string => {
  if (!preview.covered) return 'Your credit can’t cover this purchase.';
  const bonus = Number(preview.card_credit_usd ?? 0);
  const hasBonus = Number.isFinite(bonus) && bonus > 0;
  const lines = preview.lines.filter(line => Number(line.locked_usd) > 0);
  if (!lines.length) {
    if (!hasBonus) return 'Collateral that’s already locked covers this purchase.';
    return bonus >= Number(preview.amount_usd)
      ? 'Your card bonus covers this purchase.'
      : 'Your card bonus and collateral that’s already locked cover this purchase.';
  }
  const lock = lines.every(line => isPreviewYieldKey(line.asset))
    ? 'Locked, not sold. It keeps earning and unlocks as you repay.'
    : 'Locked, not sold. It unlocks as you repay.';
  return hasBonus ? `Your card bonus pays ${money(bonus)} first. ${lock}` : lock;
};
