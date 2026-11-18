import { formatUnits, parseUnits } from 'viem';

/**
 * Writes a number given in exponent form ("1e-8", "1.5E+3") as plain decimal text, by moving the
 * decimal point in the digit string. Plain decimal text comes back unchanged.
 */
const expandExponent = (text: string): string => {
  const match = /^(-?)(\d+)(?:\.(\d*))?e([+-]?\d+)$/i.exec(text);
  if (!match) return text;
  const [, sign, whole, fraction = '', exponent] = match;
  const digits = `${whole}${fraction}`;
  const point = whole.length + Number(exponent);
  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return `${sign}${digits}${'0'.repeat(point - digits.length)}`;
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
};

/**
 * An activity row's BTC amount, from its decimal text and never through a float: cut (not rounded)
 * to `maxFraction` places in bigint units, trailing zeros dropped ("1.00000000" → "1", "1.2" →
 * "1.2"), thousands grouped, and an amount above zero that cuts to 0 shown as "< 0.000001".
 * Exponent-form text ("1e-8", which a number's toString gives below 1e-6) is expanded first.
 * Text that is not a number comes back as it is.
 */
export const formatBtcRowAmount = (amount: string, maxFraction: number): string => {
  const text = expandExponent(amount.trim());
  if (!/^-?\d+(\.\d*)?$/.test(text)) return amount;
  // Parse at the text's own precision, so nothing is rounded before the cut.
  const precision = Math.max(text.split('.')[1]?.length ?? 0, maxFraction);
  const exact = parseUnits(text, precision);
  const cut = exact / 10n ** BigInt(precision - maxFraction);
  if (cut === 0n && exact !== 0n) return `< ${formatUnits(1n, maxFraction)}`;
  const [whole, fraction] = formatUnits(cut, maxFraction).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
};
