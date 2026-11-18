import { isPreviewYieldKey } from '@/components/Card/OrderList/previewAssets';

import type { CardCollateralOrderPreviewResponse } from '@/lib/types';

/** `int.frac` rounded half up to `places` decimals, on the digits: no float in between. */
const roundDecimal = (int: string, frac: string, places: number): [string, string] => {
  const kept = BigInt(int + frac.padEnd(places, '0').slice(0, places));
  const rounded = (frac[places] ?? '0') >= '5' ? kept + 1n : kept;
  const digits = rounded.toString().padStart(places + 1, '0');
  return [digits.slice(0, digits.length - places), digits.slice(digits.length - places)];
};

const groupThousands = (int: string): string => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * A token amount off the wire ("0.00123456"): four decimals from one up, four significant digits
 * under it, so a satoshi-sized lock does not read as "0". Worked on the decimal string itself, so
 * an 18-decimal amount keeps every digit it shows. Left as sent if it is not a plain decimal.
 */
export const formatLockedAmount = (amount: string): string => {
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(amount.trim());
  if (!match || !(match[2] || match[3])) return amount;
  const [, sign, rawInt, rawFrac = ''] = match;
  const int = rawInt.replace(/^0+/, '') || '0';
  // Under one: keep four digits past the leading zeros. One and up (and zero): four decimals.
  const leadingZeros = rawFrac.search(/[1-9]/);
  const places = int === '0' && leadingZeros !== -1 ? leadingZeros + 4 : 4;
  const [roundedInt, roundedFrac] = roundDecimal(int, rawFrac, places);
  const frac = roundedFrac.replace(/0+$/, '');
  const negative = sign === '-' && (roundedInt !== '0' || frac !== '');
  return `${negative ? '-' : ''}${groupThousands(roundedInt)}${frac ? `.${frac}` : ''}`;
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
