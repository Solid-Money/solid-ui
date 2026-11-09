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

/**
 * A per-million-token price, the way Figma's price sheet writes it: `$1.14`
 * and `$0.27` in cents, `$0.072` and `$0.004` in tenths of a cent below
 * $0.10, and `Free` for a model we don't charge for.
 */
export const formatAiApiTokenPrice = (usdPerMTok: number): string => {
  const value = Math.max(0, usdPerMTok || 0);
  if (value === 0) return 'Free';
  // Rounded to tenths of a cent first, so $0.0996 reads as $0.10 and not $0.100.
  const thousandths = Math.round(value * 1000) / 1000;
  if (thousandths >= 0.1) return `$${value.toFixed(2)}`;
  if (thousandths >= 0.001) return `$${thousandths.toFixed(3)}`;
  return '<$0.001';
};

type AiApiPricedModel = {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  cachedInputUsdPerMTok?: number | null;
  officialInputUsdPerMTok: number | null;
  officialOutputUsdPerMTok: number | null;
};

/** Three input tokens to one output token: what a typical agent request reads and writes. */
const blend = (input: number, output: number) => (3 * input + output) / 4;

/** A model we charge nothing for: input, output or cached. */
export const aiApiModelIsFree = (model: AiApiPricedModel): boolean =>
  model.inputUsdPerMTok === 0 && model.outputUsdPerMTok === 0 && !model.cachedInputUsdPerMTok;

/**
 * How far below the model maker's list price ours is, as a whole percent, on
 * Figma's 3:1 input:output blend, rounded down so the tag never claims more
 * than the blend saves. Null when there is no list price to compare with, or
 * nothing is saved.
 */
export const aiApiModelDiscount = (model: AiApiPricedModel): number | null => {
  const { officialInputUsdPerMTok: officialIn, officialOutputUsdPerMTok: officialOut } = model;
  if (!officialIn || !officialOut || officialIn <= 0 || officialOut <= 0) return null;
  const discount =
    1 - blend(model.inputUsdPerMTok, model.outputUsdPerMTok) / blend(officialIn, officialOut);
  // The epsilon keeps a float like 0.9399999 from reading as 93%.
  const percent = Math.floor(discount * 100 + 1e-9);
  return percent > 0 ? percent : null;
};

/** `−94%`, with a true minus sign. */
export const formatAiApiDiscount = (percent: number): string => `\u2212${percent}%`;

/** The green tag on a model: `Free`, `−94%`, or none when there is nothing to say. */
export const aiApiModelTag = (model: AiApiPricedModel): string | null => {
  if (aiApiModelIsFree(model)) return 'Free';
  const discount = aiApiModelDiscount(model);
  return discount ? formatAiApiDiscount(discount) : null;
};

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

/** `Six`, to open a sentence with; `12` past nine. */
export const formatAiApiCount = (count: number): string => COUNT_WORDS[count] ?? `${count}`;

/**
 * Every capped tier's monthly AI cashback cap, lowest first: `up to $50 a month
 * on Core, $100 on Prime and $200 on Ultra`. Null when no tier has a cap.
 */
export const formatAiApiTierCaps = (
  tiers: readonly { tier: string; monthlyCapUsd: number }[],
): string | null => {
  const caps = tiers
    .filter(tier => tier.monthlyCapUsd > 0)
    .map(
      (tier, index) =>
        `${formatAiApiLimit(tier.monthlyCapUsd)}${index === 0 ? ' a month' : ''} on ${tier.tier}`,
    );
  if (caps.length === 0) return null;
  const list =
    caps.length === 1 ? caps[0] : `${caps.slice(0, -1).join(', ')} and ${caps[caps.length - 1]}`;
  return `up to ${list}`;
};

/** The one rate every tier shares, or null when they differ (or there are none). */
export const aiApiSharedTierRate = (tiers: readonly { rate: number }[]): number | null =>
  tiers.length > 0 && tiers.every(tier => tier.rate === tiers[0].rate) ? tiers[0].rate : null;

/**
 * The price sheet's note: `You get 50% back on every model, up to $50 a month
 * on Core, $100 on Prime and $200 on Ultra.` Every tier's cap follows the
 * user's rate only when every tier shares it, as the intro's footnote does.
 * Otherwise, or without every tier's terms (an older backend), the user's own
 * cap stands in.
 */
export const formatAiApiCashbackNote = ({
  cashbackRate,
  cashbackTiers,
  cashbackMonthlyCapUsd,
}: {
  cashbackRate: number;
  cashbackTiers?: readonly { tier: string; rate: number; monthlyCapUsd: number }[];
  cashbackMonthlyCapUsd: number;
}): string => {
  const caps =
    cashbackTiers && aiApiSharedTierRate(cashbackTiers) !== null
      ? formatAiApiTierCaps(cashbackTiers)
      : cashbackMonthlyCapUsd > 0
        ? `up to ${formatAiApiLimit(cashbackMonthlyCapUsd)} a month`
        : null;
  return `You get ${formatAiApiRate(cashbackRate)} back on every model${caps ? `, ${caps}` : ''}.`;
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

/**
 * What a "not enough" banner says the Wallet is short of: `USDC`, or plain
 * `funds` when the token list could not be read, rather than the paid-from
 * fallback, which would read "doesn't have enough Your Wallet".
 */
export const formatAiApiBillingFunds = (tokens: readonly string[]): string =>
  tokens.length === 0 ? 'funds' : formatAiApiPaidFrom(tokens);

/**
 * What doesn't pay for usage, for users who topped up their card or saved
 * and still see the banner: the card balance always, and Savings too unless a
 * savings token (soUSD and the like) is one of the billing tokens. A list that
 * could not be read names the card balance alone, which is true either way.
 */
export const formatAiApiNotCounted = (tokens: readonly string[]): string =>
  tokens.length > 0 && !tokens.some(token => /^so[A-Z]/.test(token))
    ? 'Your card balance and Savings don’t count.'
    : 'Your card balance doesn’t count.';
