/**
 * How the swap screens write numbers: token amounts with thousands separators
 * and only the digits worth reading, dollars to the cent.
 *
 *   18.43 → "18.43"    0.00081234 → "0.0008123"    145000 → "145,000"
 */
export function formatSwapAmount(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const abs = Math.abs(value);
  if (abs < 0.000001) return '<0.000001';
  // Four significant digits below 1, two decimals above, six at most.
  const maximumFractionDigits =
    abs >= 1 ? 2 : Math.min(6, Math.max(2, 3 - Math.floor(Math.log10(abs))));
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

/** "$19.94", "<$0.01", "$1,204.10". */
export function formatSwapUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.00';
  if (value < 0.01) return '<$0.01';
  return `$${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

/**
 * What the amount field keeps of what was typed: digits and one decimal point,
 * a comma read as the point (decimal-pad shows one in some locales), no more
 * fraction digits than the token has, and no leading zeros.
 */
export function sanitizeAmountInput(raw: string, decimals = 18): string {
  let value = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = value.split('.');
  const hasPoint = value.includes('.');
  const fraction = rest.join('').slice(0, decimals);
  const trimmedWhole = whole.replace(/^0+(?=\d)/, '');
  value = hasPoint ? `${trimmedWhole || '0'}.${fraction}` : trimmedWhole;
  return value;
}

/** Thousands separators for an amount being typed, keeping a trailing point. */
export function groupAmountInput(value: string): string {
  if (!value) return value;
  const [whole, fraction] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
