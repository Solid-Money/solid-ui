const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const longDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });

// Standalone formatters rather than `formatNumber` from `@/lib/utils`: that one
// drops the cents below $1 ($0.5), and importing it pulls the wallet stack in.
const usd = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const upToOneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** `$42.80` — every spend and cashback figure. */
export const formatAiApiUsd = (value: number): string => `$${usd.format(Math.max(0, value || 0))}`;

/** `+$21.40` — cashback, which is always money coming back. */
export const formatAiApiCashback = (value: number): string => `+${formatAiApiUsd(value)}`;

/** `$50` — limits, which are whole dollars. */
export const formatAiApiLimit = (value: number): string => `$${whole.format(value || 0)}`;

/** `50%` from a rate of 0.5. */
export const formatAiApiRate = (rate: number): string =>
  `${upToOneDecimal.format(Math.round((rate || 0) * 1000) / 10)}%`;

/** `1.2M tokens`, `840K tokens`, `312 tokens`. */
export const formatAiApiTokens = (tokens: number): string => {
  const value = Math.max(0, tokens || 0);
  if (value >= 1_000_000) return `${upToOneDecimal.format(value / 1_000_000)}M tokens`;
  if (value >= 1_000) return `${upToOneDecimal.format(value / 1_000)}K tokens`;
  return `${whole.format(value)} tokens`;
};

/** `Nov 1` — when limits reset and cashback lands. Dates are UTC days. */
export const formatAiApiShortDate = (iso: string | Date): string =>
  shortDate.format(typeof iso === 'string' ? new Date(iso) : iso);

/** `Oct 14, 2026`. */
export const formatAiApiLongDate = (iso: string | Date): string =>
  longDate.format(typeof iso === 'string' ? new Date(iso) : iso);

/** `October`, for the daily spend chart's heading. */
export const formatAiApiMonth = (iso: string | Date): string =>
  monthName.format(typeof iso === 'string' ? new Date(iso) : iso);

/** A day key (`2026-10-14`) as a short date. */
export const formatAiApiDay = (day: string): string => formatAiApiShortDate(`${day}T00:00:00Z`);

/** `2 min ago`, `3 h ago`, `yesterday`, `Oct 3`, or `never`. */
export const formatAiApiLastUsed = (iso: string | null, now: Date = new Date()): string => {
  if (!iso) return 'never';
  const then = new Date(iso);
  const seconds = Math.max(0, (now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 60 * 60) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 24 * 60 * 60) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 48 * 60 * 60) return 'yesterday';
  return formatAiApiShortDate(then);
};

/** The key as the app may show it: never the secret, only its last four. */
export const maskAiApiKey = (last4: string): string => `…${last4}`;

/** The limit progress, clamped to 0..1. */
export const aiApiLimitProgress = (spentUsd: number, limitUsd: number): number =>
  limitUsd > 0 ? Math.min(1, Math.max(0, spentUsd / limitUsd)) : 0;

/**
 * The tokens a charge is drawn from, as a user reads them: `USDC`, or
 * `USDC, then soUSD`. Empty — the list could not be read — says what is still
 * true without naming a token.
 */
export const formatAiApiPaidFrom = (tokens: readonly string[]): string => {
  if (tokens.length === 0) return 'Your Wallet';
  if (tokens.length === 1) return tokens[0];
  return `${tokens.slice(0, -1).join(', ')}, then ${tokens[tokens.length - 1]}`;
};
