/**
 * Formatting for Orchestra's wire amounts.
 *
 * Every amount on the wire is an integer string in the asset's smallest unit.
 * They are parsed as BigInt rather than Number: 50,000 USD of a 6-decimal asset
 * is 5e10, and a 8-decimal one puts BTC amounts well past where a double stops
 * being exact.
 */

/**
 * The locale's group and decimal separators, discovered once from a plain
 * Number.
 *
 * Intl is only ever handed a Number in this module. `Intl.NumberFormat.format`
 * is specified to accept a BigInt, but the runtimes this app ships on — Hermes,
 * and the Intl shim under React Native Web — coerce the argument with ToNumber
 * first, which throws "Cannot convert a BigInt value to a number". Node's Intl
 * does accept one, so a unit test will not catch it; only the app will.
 *
 * Grouping the digit string ourselves keeps the exactness BigInt was chosen for
 * and never puts one in front of Intl.
 */
const SEPARATORS = (() => {
  try {
    const parts = new Intl.NumberFormat(undefined).formatToParts(11111.1);
    return {
      group: parts.find(part => part.type === 'group')?.value ?? ',',
      decimal: parts.find(part => part.type === 'decimal')?.value ?? '.',
    };
  } catch {
    return { group: ',', decimal: '.' };
  }
})();

/** Insert the locale's thousands separator into a plain digit string. */
const groupDigits = (digits: string): string =>
  digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATORS.group);

/**
 * Render a smallest-unit integer string as a decimal.
 *
 * Returns undefined for anything that isn't one, so a caller can distinguish
 * "not priced yet" from "priced at zero" — a field Orchestra omitted and a
 * field it set to "0" mean different things on the quote breakdown.
 */
export const formatSmallestUnits = (
  value: string | undefined,
  decimals: number | undefined,
  maximumFractionDigits = 2,
): string | undefined => {
  if (value == null || decimals == null) return undefined;
  if (!/^-?\d+$/.test(value)) return undefined;

  const negative = value.startsWith('-');
  const digits = (negative ? value.slice(1) : value).padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = decimals > 0 ? digits.slice(digits.length - decimals) : '';

  // Round by carrying on the first dropped digit, so the value never passes
  // through a float. `padEnd` matters when the asset has fewer decimals than we
  // are willing to show: 2-decimal "4975" asked for 4 places is 49.75, not
  // 0.4975.
  const kept = fraction.slice(0, maximumFractionDigits).padEnd(maximumFractionDigits, '0');
  const nextDigit = fraction.charCodeAt(maximumFractionDigits) - 48;
  const rounded = BigInt(whole + kept) + (nextDigit >= 5 ? 1n : 0n);

  const scale = 10n ** BigInt(maximumFractionDigits);
  const unit = rounded / scale;
  const rest = (rounded % scale).toString().padStart(maximumFractionDigits, '0');

  const formattedUnit = groupDigits(unit.toString());
  const trimmed = rest.replace(/0+$/, '');
  return `${negative ? '-' : ''}${formattedUnit}${
    trimmed ? `${SEPARATORS.decimal}${trimmed}` : ''
  }`;
};

/** Sats, grouped — "44,210 sats". Already a digit string; no BigInt needed. */
export const formatSats = (value: string | undefined): string | undefined =>
  value == null || !/^\d+$/.test(value) ? undefined : `${groupDigits(value)} sats`;

export const formatUsd = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
