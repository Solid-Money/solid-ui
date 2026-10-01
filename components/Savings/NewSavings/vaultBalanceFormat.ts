import { formatNumber } from '@/lib/utils';

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
 * Compact USD figure for the vault balance card, e.g. `6.76K USD`.
 *
 * Built by hand rather than with `Intl.NumberFormat({ notation: 'compact' })`:
 * Hermes on iOS ignores `notation`, so the card showed the full `6,759.16 USD`
 * there, which wrapped and was clipped by the fixed-height card.
 */
export const formatCompactVaultUsd = (value: number) => {
  const safeValue = Math.max(Number(value) || 0, 0);

  let unit: (typeof COMPACT_UNITS)[number] = COMPACT_UNITS[0];
  let scaled = roundToHundredths(safeValue);
  for (const next of COMPACT_UNITS.slice(1)) {
    // Compare the rounded figure so 999,999 reads 1M rather than 1000K.
    if (scaled < 1000) break;
    unit = next;
    scaled = roundToHundredths(safeValue / next.value);
  }

  return `${scaled}${unit.suffix} USD`;
};

export const formatExactVaultUsd = (value: number) =>
  `$${formatNumber(Math.max(Number(value) || 0, 0), 1, 1)}`;
