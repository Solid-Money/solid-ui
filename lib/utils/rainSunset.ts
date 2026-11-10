import { formatUnits } from 'viem';

import type {
  CardCollateralTokenBalanceDto,
  CardStatusResponse,
  RainSunsetStatus,
} from '@/lib/types';

/**
 * Rain sunset: what the app says to a cardholder whose card is closing.
 *
 * Pure, so the copy and the states can be unit-tested without rendering. The
 * design's copy rule applies throughout: never "Rain" — it is "your card" and
 * "your new Solid card".
 */

/** The month names the design spells out ("December 7"), never localised digits. */
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * `2026-12-07` → `{ long: 'December 7', short: 'Dec 7' }`, or null when there
 * is no announced date (or it does not parse). Read as a calendar date, not an
 * instant: no timezone can move the day.
 */
export function formatClosingDate(
  closesAt: string | null | undefined,
): { long: string; short: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(closesAt ?? '');
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const name = MONTHS[month - 1];
  return { long: `${name} ${day}`, short: `${name.slice(0, 3)} ${day}` };
}

/**
 * `$248.50` — always two decimals, the way the design writes balances. Local
 * rather than `formatUSD` from `lib/utils`, which pulls storage and the API
 * client in with it and so cannot load in a unit test.
 */
export function formatClosingBalance(usd: number): string {
  const value = Number.isFinite(usd) ? Math.max(usd, 0) : 0;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Whether the closing card still holds a balance worth moving. Anything from a
 * cent up is offered; only above `maxLeftoverUsd` does it block the new card
 * (see {@link blocksNewCard}).
 */
export function hasClosingBalance(balanceUsd: number | null | undefined): boolean {
  if (balanceUsd == null || !Number.isFinite(balanceUsd)) return false;
  return balanceUsd >= 0.01;
}

/**
 * Whether the balance on the closing card could not be read (the collateral
 * read failed or has not answered). Never the same as an empty card: telling a
 * cardholder there is nothing to withdraw, and letting them close the notice,
 * is wrong whenever there is.
 */
export function isClosingBalanceUnknown(balanceUsd: number | null | undefined): boolean {
  return balanceUsd == null || !Number.isFinite(balanceUsd);
}

/** Whether the balance is high enough to block issuing the new card. */
export function blocksNewCard(
  balanceUsd: number | null | undefined,
  sunset?: Pick<RainSunsetStatus, 'maxLeftoverUsd'> | null,
): boolean {
  if (balanceUsd == null || !Number.isFinite(balanceUsd)) return false;
  return balanceUsd > (sunset?.maxLeftoverUsd ?? 1);
}

/** The Rain sunset block for this status, when it applies. */
export function rainSunsetOf(
  cardStatus: CardStatusResponse | null | undefined,
): RainSunsetStatus | null {
  return cardStatus?.rainSunset ?? null;
}

/** The user has started their move to the new card. */
export function hasStartedNewCard(sunset: RainSunsetStatus | null | undefined): boolean {
  return Boolean(sunset?.migration);
}

/**
 * Which Home banner (Figma "Rain closing / Home banner") the user gets.
 *
 * - `new-card`: they can get the new card now — the design's "Get your new
 *   Solid card" state, offered from day one rather than after the close.
 * - `closing-balance`: no new card for them yet, and money left on the card —
 *   or a balance that could not be read, which is never shown as empty.
 * - `closing-empty`: no new card for them yet and nothing left to withdraw.
 */
export type RainClosingBannerState = 'new-card' | 'closing-balance' | 'closing-empty';

export function rainClosingBannerState(
  sunset: RainSunsetStatus | null | undefined,
  balanceUsd: number | null | undefined,
): RainClosingBannerState | null {
  if (!sunset) return null;
  if (sunset.newCardAvailable) return 'new-card';
  if (!sunset.notice) return null;
  if (isClosingBalanceUnknown(balanceUsd)) return 'closing-balance';
  return hasClosingBalance(balanceUsd) ? 'closing-balance' : 'closing-empty';
}

/** "on Dec 7" / "soon" — the end of "Your card closes …". */
export function closesPhrase(
  closesAt: string | null | undefined,
  form: 'long' | 'short' = 'short',
): string {
  const date = formatClosingDate(closesAt);
  return date ? `on ${date[form]}` : 'soon';
}

/** Copy for the Home banner, per state. */
export function homeBannerCopy(
  state: RainClosingBannerState,
  sunset: RainSunsetStatus,
  balanceUsd: number | null | undefined,
): { title: string; message: string } {
  const closes = closesPhrase(sunset.closesAt, 'short');
  switch (state) {
    case 'new-card':
      // A Rain applicant who never got a card has no "current card" to close.
      if (!sunset.hasRainCard) {
        return hasStartedNewCard(sunset)
          ? {
              title: 'Finish getting your Solid card',
              message: 'Pick up your identity check where you left off.',
            }
          : {
              title: 'Get your Solid card',
              message: 'Solid cards now come from our new card partner. It takes a few minutes.',
            };
      }
      return hasStartedNewCard(sunset)
        ? {
            title: 'Finish getting your new card',
            message: `Your current card closes ${closes}. Pick up where you left off.`,
          }
        : {
            title: 'Get your new Solid card',
            message: `Your current card closes ${closes}. A new one takes a few minutes.`,
          };
    case 'closing-balance':
      return {
        title: `Your card closes ${closes}`,
        message: isClosingBalanceUnknown(balanceUsd)
          ? 'Withdraw your card balance before then.'
          : `Withdraw your ${formatClosingBalance(balanceUsd ?? 0)} card balance before then.`,
      };
    case 'closing-empty':
      return {
        title: `Your card closes ${closes}`,
        message: 'Nothing to withdraw. Move any subscriptions to another card before then.',
      };
  }
}

/** Copy for the card-screen notice (Figma "Rain closing / Card notice"). */
export function cardNoticeCopy(
  sunset: RainSunsetStatus,
  balanceUsd: number | null | undefined,
  countryName?: string | null,
): { title: string; message: string } {
  const date = formatClosingDate(sunset.closesAt);
  const title = date ? `This card closes on ${date.long}` : 'This card is closing';
  const balance = isClosingBalanceUnknown(balanceUsd)
    ? 'Withdraw your card balance to your wallet before then. '
    : hasClosingBalance(balanceUsd)
      ? `Withdraw your ${formatClosingBalance(balanceUsd ?? 0)} to your wallet before then. `
      : '';

  if (sunset.newCardAvailable) {
    return {
      title,
      message: (
        "We're moving Solid cards to a new card partner. Get your new Solid card now, " +
        `it takes a few minutes. ${balance}`
      ).trim(),
    };
  }

  const where = countryName ? ` in ${countryName}` : '';
  const when = date ? ` after ${date.long}` : ' once this card closes';
  return {
    title,
    message:
      `Solid cards won't be available${where}${when}. ${balance}` +
      'Your Solid account keeps working as usual.',
  };
}

/**
 * Whether the card issuance flow should hand this user to the new-card screen
 * instead: a Rain applicant with no card, whose Rain application can no longer
 * become one (new Rain cards are closed) but who can get the new card. A Rain
 * cardholder is not sent anywhere — they reach the new card from the notice on
 * the card they hold.
 */
export function routesToNewCard(cardStatus: CardStatusResponse | null | undefined): boolean {
  const sunset = cardStatus?.rainSunset;
  if (!sunset || sunset.hasRainCard) return false;
  return sunset.newCardAvailable || Boolean(sunset.migration);
}

/**
 * Whole cents in a dollar figure, rounded down, read from the number's own
 * decimal digits — never `usd * 100`, which floating point can push across a
 * cent: `(0.3 - 0.1) * 100` is exactly 20, though the figure is under 20
 * cents. Zero for anything that is not a positive amount.
 */
export function floorCents(usd: number | null | undefined): bigint {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return 0n;
  const text = String(usd);
  // Exponent notation: below a cent (1e-7) or beyond any balance (1e21).
  if (/e/i.test(text)) return usd < 1 ? 0n : BigInt(Math.floor(usd)) * 100n;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
}

/** Token units in whole cents of a dollar stablecoin. */
function centsToUnits(cents: bigint, decimals: number): bigint {
  return decimals >= 2 ? cents * 10n ** BigInt(decimals - 2) : cents / 10n ** BigInt(2 - decimals);
}

/**
 * Whole cents in a token amount (a dollar stablecoin): rounded up for what it
 * uses of a cap, so the cap left is never overstated, or down for what the
 * screen says moved, so that is never overstated either.
 */
export function unitsToCents(units: bigint, decimals: number, round: 'up' | 'down'): bigint {
  if (decimals <= 2) return units * 10n ** BigInt(2 - decimals);
  const scale = 10n ** BigInt(decimals - 2);
  return round === 'up' ? (units + scale - 1n) / scale : units / scale;
}

/**
 * One token's withdrawal: all of it, or — when Rain caps the withdrawal below
 * the token's balance, because its credit line still needs collateral — as
 * much as the cap (in whole cents) allows, never past the balance. Integer
 * token units throughout, and the decimal string the withdrawal takes. Card
 * collateral is a dollar stablecoin, so a cent of cap is a cent of token.
 */
export function tokenWithdrawal(
  token: Pick<CardCollateralTokenBalanceDto, 'rawBalance' | 'decimals'>,
  capCents: bigint | undefined,
): { units: bigint; amount: string } {
  const raw = BigInt(token.rawBalance || '0');
  const capped =
    capCents === undefined ? raw : centsToUnits(capCents > 0n ? capCents : 0n, token.decimals);
  const units = capped < raw ? capped : raw;
  return { units, amount: formatUnits(units, token.decimals) };
}
