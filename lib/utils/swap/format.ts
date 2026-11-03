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

/** "1,234" or "1,234,567.8": thousands commas, as `groupAmountInput` writes them. */
const GROUPED_AMOUNT = /^\d{1,3}(,\d{3})+(\.\d*)?$/;

/**
 * A field showing `groupAmountInput`'s commas, read back for
 * `sanitizeAmountInput`, which takes any comma for the point. `shown` is what
 * the field held before this edit.
 *
 * Commas the edit kept from `shown` are thousands separators and go. In what
 * the edit added (a typed key, or a paste over a selection) a comma is the
 * point from a decimal-comma keyboard: the first becomes the point and any
 * others go. Two cases read every comma as grouping instead: an amount that
 * already has a point, and a whole field that is a grouped amount, such as a
 * pasted "2,500".
 */
export function ungroupAmountInput(text: string, shown: string): string {
  if (text.includes('.') || GROUPED_AMOUNT.test(text)) return text.replace(/,/g, '');
  // The edit is what lies between the parts of `shown` it left at either end.
  let start = 0;
  while (start < text.length && start < shown.length && text[start] === shown[start]) start += 1;
  let end = 0;
  while (
    end < text.length - start &&
    end < shown.length - start &&
    text[text.length - 1 - end] === shown[shown.length - 1 - end]
  ) {
    end += 1;
  }
  const kept = (part: string) => part.replace(/,/g, '');
  const added = text
    .slice(start, text.length - end)
    .replace(',', '.')
    .replace(/,/g, '');
  return `${kept(text.slice(0, start))}${added}${kept(text.slice(text.length - end))}`;
}
