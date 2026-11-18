import type { APYs } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days each APY window the analytics API reports covers. */
export const APY_WINDOW_DAYS = {
  oneDay: 1,
  sevenDay: 7,
  fifteenDay: 15,
  thirtyDay: 30,
} as const;

/**
 * How long a new vault is shown at its trailing day's APY. Until then its 7,
 * 15 and 30-day windows still reach back to its first days, before it earned:
 * they read low, and move as those days drop out.
 */
export const NEW_VAULT_DAYS = 15;

type Now = Date | number;

/**
 * Whether the vault's rate history began under NEW_VAULT_DAYS ago. An analytics
 * API that doesn't say when (`firstRateAt` absent or null) reads as not new, and
 * so does a start ahead of this device's clock: a clock that far behind would
 * otherwise make every vault look new.
 */
export const isNewVault = (apys: APYs | undefined, now: Now = Date.now()) => {
  if (!apys?.firstRateAt) return false;
  const startedAt = Date.parse(apys.firstRateAt);
  if (Number.isNaN(startedAt)) return false;
  const age = Number(now) - startedAt;
  return age >= 0 && age < NEW_VAULT_DAYS * DAY_MS;
};

/**
 * When `isNewVault` next changes for this vault, as a timestamp: its start while
 * that is still ahead of the clock, else the end of its first NEW_VAULT_DAYS.
 * Undefined once it never will, or when the API doesn't say when it started.
 */
export const newVaultChangesAt = (
  apys: APYs | undefined,
  now: Now = Date.now(),
): number | undefined => {
  if (!apys?.firstRateAt) return undefined;
  const startedAt = Date.parse(apys.firstRateAt);
  if (Number.isNaN(startedAt)) return undefined;
  if (Number(now) < startedAt) return startedAt;
  const endsAt = startedAt + NEW_VAULT_DAYS * DAY_MS;
  return Number(now) < endsAt ? endsAt : undefined;
};

/**
 * A new vault's trailing-day APY, when there is a positive one. Undefined for
 * any other vault, and for a new one whose last day earned nothing.
 */
export const newVaultApy = (apys: APYs | undefined, now: Now = Date.now()) => {
  const oneDay = apys?.oneDay ?? 0;
  return isNewVault(apys, now) && oneDay > 0 ? oneDay : undefined;
};

/**
 * The APY a vault is shown at, and the days it covers. A new vault's trailing
 * day; otherwise the best of the 7, 15 and 30-day windows (30 days, at 0%,
 * when none is positive).
 */
export const displayApy = (
  apys: APYs | undefined,
  now: Now = Date.now(),
): { apy: number; days: number } => {
  const oneDay = newVaultApy(apys, now);
  if (oneDay !== undefined) return { apy: oneDay, days: APY_WINDOW_DAYS.oneDay };

  const best = [
    { apy: apys?.sevenDay ?? 0, days: APY_WINDOW_DAYS.sevenDay },
    { apy: apys?.fifteenDay ?? 0, days: APY_WINDOW_DAYS.fifteenDay },
    { apy: apys?.thirtyDay ?? 0, days: APY_WINDOW_DAYS.thirtyDay },
  ]
    .filter(window => window.apy > 0)
    .reduce<{ apy: number; days: number } | undefined>(
      (a, b) => (!a || b.apy > a.apy ? b : a),
      undefined,
    );

  return best ?? { apy: 0, days: APY_WINDOW_DAYS.thirtyDay };
};

/** The span an APY covers, for copy like "over the last …": "24 hours" or "7 days". */
export const apyPeriodText = (days: number) => (days === 1 ? '24 hours' : `${days} days`);

/**
 * An APY as a percentage, to one decimal. A positive rate one decimal would
 * round to "0.0%" gets two, or "<0.01%" below that, so it never reads as
 * nothing; a true 0 is still "0.0%".
 */
export const formatApyPercent = (apy: number) => {
  if (apy > 0 && apy < 0.005) return '<0.01%';
  if (apy > 0 && apy < 0.05) return `${apy.toFixed(2)}%`;
  return `${apy.toFixed(1)}%`;
};
