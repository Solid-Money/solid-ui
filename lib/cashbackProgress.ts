/**
 * How the cashback surfaces draw "earned so far" and "earned but not yet paid"
 * on one progress line.
 *
 * Cashback settles days after the purchase, so the earned figure is $0 to
 * someone who just spent. Pending is the rest of that answer, and it shares the
 * earned line rather than getting one of its own: it is the same money, one
 * settlement window away — a second bar would read as a different benefit.
 */

/**
 * The green every settled cashback figure and the earned segment are drawn in.
 * The same value as the `brand` token, spelled out for the StyleSheet-based
 * cards that cannot reach a Tailwind class.
 */
export const CASHBACK_EARNED_COLOR = '#94F27F';

/**
 * The pending segment: the same green, dimmed. Distinct enough to read as a
 * separate stretch of the line, close enough that it still reads as cashback
 * rather than as a second, unrelated metric.
 */
export const CASHBACK_PENDING_COLOR = 'rgba(148, 242, 127, 0.4)';

/** The pending labels, lifted for legibility against the card backgrounds. */
export const CASHBACK_PENDING_TEXT_COLOR = 'rgba(148, 242, 127, 0.7)';

export interface CashbackProgressInput {
  /** Cashback already paid out this month, in USD. */
  earned: number;
  /** Cashback owed but still escrowed, in USD. */
  pending: number;
  /** The tier's monthly cashback cap, in USD. */
  cap: number;
}

export interface CashbackProgress {
  /** Width of the settled segment, as a percentage of the track. */
  earnedPct: number;
  /** Width of the pending segment, which continues where earned stops. */
  pendingPct: number;
}

/**
 * The two segment widths for one cashback track.
 *
 * The pending segment is what's left of the track after the earned one, so the
 * pair can never overflow: a projection that would break through the cap is
 * shown filling the line, not spilling past it. (The backend already trims the
 * projection to the cap, so that clamp is a guard rather than the normal case.)
 *
 * A cap of 0 leaves both at 0 — with nothing to fill against, a full bar would
 * claim the user had maxed out a cap that isn't configured.
 */
export const resolveCashbackProgress = ({
  earned,
  pending,
  cap,
}: CashbackProgressInput): CashbackProgress => {
  const safeCap = toPositive(cap);
  if (safeCap === 0) return { earnedPct: 0, pendingPct: 0 };

  const earnedPct = Math.min(100, (toPositive(earned) / safeCap) * 100);

  return {
    earnedPct,
    pendingPct: Math.min(100 - earnedPct, (toPositive(pending) / safeCap) * 100),
  };
};

/** A non-finite or negative amount contributes nothing rather than NaN. */
const toPositive = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);
