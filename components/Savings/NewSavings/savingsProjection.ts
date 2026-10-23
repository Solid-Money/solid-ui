import { ChartPayload, VaultType } from '@/lib/types';
import { isEurVault } from '@/lib/vaultCurrency';

/** Simulation horizon and sampling for the "Simulate your savings" chart. */
export const SIMULATE_YEARS = 10;
const POINTS_PER_YEAR = 12; // monthly samples → a smooth curve
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
// Fixed base time so the series is stable across renders (x is only used for
// ordering; the chart shows no date axis).
const BASE_TIME = 1704067200000; // 2024-01-01

/** Illustrative rate for a USD-valued vault whose APY has not loaded or is reported as 0. */
const FALLBACK_SIMULATION_APY = 5;

/**
 * The rate the projection runs at. A USD-valued vault with no reported APY keeps
 * the illustrative 5%; soEURC projects at its reported rate, 0% for now.
 */
export const simulationApy = (vaultType: VaultType, apy: number | undefined) => {
  if (apy !== undefined && Number.isFinite(apy) && apy > 0) return apy;
  return isEurVault(vaultType) ? 0 : FALLBACK_SIMULATION_APY;
};

/**
 * Compound-growth projection: value(t) = principal * (1 + apy)^t over
 * SIMULATE_YEARS, sampled monthly. Returns ChartPayload[] for the chart and the
 * future-balance / earned readouts.
 */
export const buildProjectionSeries = (principal: number, apyPercent: number): ChartPayload[] => {
  const rate = Math.max(apyPercent, 0) / 100;
  const totalMonths = SIMULATE_YEARS * POINTS_PER_YEAR;
  const series: ChartPayload[] = [];
  for (let month = 0; month <= totalMonths; month++) {
    const years = month / POINTS_PER_YEAR;
    const value = principal * Math.pow(1 + rate, years);
    series.push({ time: BASE_TIME + month * MONTH_MS, value });
  }
  return series;
};

/** Number of months represented by a series index (0-based). */
export const indexToYears = (index: number) => index / POINTS_PER_YEAR;

/** Human label for a fractional-year position, e.g. "10 years" / "6 months". */
export const formatHorizonLabel = (index: number) => {
  const years = indexToYears(index);
  if (years < 1) {
    const months = Math.round(years * 12);
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  const rounded = Math.round(years * 10) / 10;
  const isWhole = rounded % 1 === 0;
  const display = isWhole ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${display} year${rounded === 1 ? '' : 's'}`;
};
