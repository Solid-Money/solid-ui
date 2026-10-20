import { formatNumber } from '@/lib/utils';
import { CURRENCY_SYMBOLS } from '@/lib/utils/cardHelpers';
import { type VaultCurrency } from '@/lib/vaultCurrency';

/** Ascending, so a value that rounds up into the next unit is promoted. */
const COMPACT_UNITS = [
  { value: 1, suffix: '' },
  { value: 1e3, suffix: 'K' },
  { value: 1e6, suffix: 'M' },
  { value: 1e9, suffix: 'B' },
  { value: 1e12, suffix: 'T' },
] as const;

const roundToHundredths = (value: number) => Math.round(value * 100) / 100;

/**
 * Compact figure for the vault balance card in the vault's own currency, e.g.
 * `6.76K USD`, or `6.76K EUR` on the soEURC vault — EUR is never shown as USD.
 *
 * Built by hand rather than with `Intl.NumberFormat({ notation: 'compact' })`:
 * Hermes on iOS ignores `notation`, so the card showed the full `6,759.16 USD`
 * there, which wrapped and was clipped by the fixed-height card.
 */
export const formatCompactVaultAmount = (value: number, currency: VaultCurrency = 'USD') => {
  const safeValue = Math.max(Number(value) || 0, 0);

  let unit: (typeof COMPACT_UNITS)[number] = COMPACT_UNITS[0];
  let scaled = roundToHundredths(safeValue);
  for (const next of COMPACT_UNITS.slice(1)) {
    // Compare the rounded figure so 999,999 reads 1M rather than 1000K.
    if (scaled < 1000) break;
    unit = next;
    scaled = roundToHundredths(safeValue / next.value);
  }

  return `${scaled}${unit.suffix} ${currency}`;
};

/** One-decimal figure with the vault currency's symbol: `$363.9`, `€363.9`. */
export const formatExactVaultAmount = (value: number, currency: VaultCurrency = 'USD') =>
  `${CURRENCY_SYMBOLS[currency]}${formatNumber(Math.max(Number(value) || 0, 0), 1, 1)}`;

export const formatCompactVaultUsd = (value: number) => formatCompactVaultAmount(value, 'USD');

export const formatExactVaultUsd = (value: number) => formatExactVaultAmount(value, 'USD');
