import { CardProvider, type TierCardFx, type TierFeeLine } from '@/lib/types';

/**
 * The card FX fee on the tier screens: the perk row that says how much of it a
 * tier covers, the "Card FX fee" row in Fees & Caps, and the footnote under it.
 *
 * All three are driven by the backend's `fees.cardFx`, which is present only
 * while flat tier FX pricing is charging — so the screen quotes the price a
 * purchase is actually charged at, and nothing while it is not.
 */

/** The Fees & Caps row key. Not a fee product: the price lives on `fees.cardFx`. */
export const CARD_FX_LINE_KEY = 'card_fx';

export const CARD_FX_LINE_LABEL = 'Card FX fee';

export const CARD_FX_FOOTNOTE =
  "Card FX fee applies to purchases in another currency. Visa's conversion still applies outside EUR, GBP and USD.";

/** The tag on the perk row while the FX price is new. */
export const CARD_FX_PERK_BADGE = 'New';

export interface CardFxPerk {
  icon: 'fx';
  title: string;
  description: string;
  badge: string;
}

/** A Fees & Caps row, with the card FX row flagged when the tier pays less than Core. */
export interface TierFeeRow extends Pick<TierFeeLine, 'key' | 'label' | 'value'> {
  /** Drawn as the green pill: this tier is spared some of the fee. */
  highlight?: boolean;
}

const isRate = (value: number) => Number.isFinite(value) && value >= 0;

/** Two fee fractions that are the same rate, give or take float noise. */
const sameRate = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/**
 * Whether this user's tier screens show the card FX price.
 *
 * The price is a Wirex one. A Rain cardholder keeps Rain's own fee until their
 * card closes, so quoting them the Wirex price would be wrong — they get the
 * screen as it was. Someone with no card yet will get a Wirex card, so they see
 * it. Nothing is shown until the card status has answered (or when it failed),
 * so a Rain cardholder is never flashed a price that is about to disappear.
 */
export const showsCardFxPricing = ({
  provider,
  cardStatusSettled,
}: {
  provider: CardProvider | null;
  cardStatusSettled: boolean;
}): boolean => cardStatusSettled && provider !== CardProvider.RAIN;

/** True when a tier pays less than the full (Core) fee — the share Solid covers. */
const coversSome = (cardFx: TierCardFx) =>
  isRate(cardFx.rate) && isRate(cardFx.baseRate) && cardFx.rate < cardFx.baseRate;

/**
 * The perk row for a tier that pays less than the full FX fee: "0% FX fee" on
 * Ultra, "Half the FX fee" on Prime, and none on Core, which pays it in full.
 *
 * Measured against the backend's Core rate rather than written per tier, so
 * repricing a tier in config moves the copy with it — a rate that is neither
 * zero nor half still reads true ("We cover 67% of the FX fee").
 */
export function cardFxPerk(cardFx: TierCardFx | null | undefined): CardFxPerk | null {
  if (!cardFx || !coversSome(cardFx)) return null;

  if (cardFx.rate === 0) {
    return {
      icon: 'fx',
      title: '0% FX fee',
      description: 'We cover the full FX fee on card spend',
      badge: CARD_FX_PERK_BADGE,
    };
  }

  if (sameRate(cardFx.rate * 2, cardFx.baseRate)) {
    return {
      icon: 'fx',
      title: 'Half the FX fee',
      description: 'We cover half the FX fee on card spend',
      badge: CARD_FX_PERK_BADGE,
    };
  }

  const covered = Math.round((1 - cardFx.rate / cardFx.baseRate) * 100);
  return {
    icon: 'fx',
    title: `${cardFx.value} FX fee`,
    description: `We cover ${covered}% of the FX fee on card spend`,
    badge: CARD_FX_PERK_BADGE,
  };
}

/**
 * The Fees & Caps rows with "Card FX fee" in its place: just above Bank
 * withdrawal, or last when there is no withdrawal row. Without a price the
 * rows come back unchanged.
 */
export function withCardFxRow(
  lines: TierFeeRow[],
  cardFx: TierCardFx | null | undefined,
): TierFeeRow[] {
  if (!cardFx || !isRate(cardFx.rate)) return lines;

  const row: TierFeeRow = {
    key: CARD_FX_LINE_KEY,
    label: CARD_FX_LINE_LABEL,
    value: cardFx.value,
    highlight: coversSome(cardFx),
  };
  const withdrawal = lines.findIndex(line => line.key === 'offramp');
  if (withdrawal === -1) return [...lines, row];
  return [...lines.slice(0, withdrawal), row, ...lines.slice(withdrawal)];
}
