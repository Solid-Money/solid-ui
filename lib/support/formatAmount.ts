/**
 * A decimal amount string ("1234.5678901") for a support context card: thousands
 * separators and at most `maxFraction` decimals (cut, not rounded), like
 * `formatNumber` shows it, but without going through a float, which can change
 * the digits of a token amount. Anything that is not a plain decimal is shown
 * as it came.
 */
export function formatDecimalAmount(value: string | number, maxFraction = 6): string {
  const text = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return text;
  const [, sign, rawWhole, rawFraction = ''] = match;
  const whole = rawWhole.replace(/^0+(?=\d)/, '');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let fraction = rawFraction.slice(0, maxFraction).replace(/0+$/, '');
  // Two decimals from 1 up, as formatNumber shows amounts.
  if (whole !== '0') fraction = fraction.padEnd(2, '0');
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`;
}
