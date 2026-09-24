import { useMemo } from 'react';

import { formatUsd, ONE_USD } from '@/constants/cardSpendModule';
import {
  borrowApyPercent,
  borrowedProgress,
  type BorrowRisk,
  borrowRisk,
  formatApy,
  healthFactorToNumber,
} from '@/constants/cardSpendV2';
import useCardSpendableBalanceUSD from '@/hooks/useCardSpendableBalance';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';

import type { SpendMode } from '@/components/Card/NewCardDetails/SpendMode/spendModes';

/** Everything the spend-mode surfaces render, already formatted. */
export interface SpendModeFigures {
  /** The mode the card is funded by today. `cash` for every cardholder on v1. */
  mode: SpendMode;
  /**
   * Whether Credit and Smart can be offered at all.
   *
   * Two things have to hold: the build reaches v2, and the cardholder has a working card to
   * migrate. Open to every cardholder — the staged-rollout cohort no longer gates it.
   */
  canChangeMode: boolean;
  /** A switch that is armed but not in force, or null. Null at the launch `modeDelay` of 0. */
  pendingMode: SpendMode | null;

  /** "$1,240" — the user's own holdings a card can draw on. */
  cashBalance: string;
  /** "$0.80" — outstanding debt, including accrued interest. */
  borrowed: string;
  /** "$246.50" — the whole credit line the cardholder's collateral backs, drawn or not. */
  creditLimit: string;
  /**
   * "$2,000.00" — what is left of the credit line to borrow.
   *
   * {@link creditLimit} less the drawn debt, and less again when the per-Safe or global debt
   * ceiling binds. Deliberately not cut by the Safe's rolling spending limit: that caps the
   * card in every mode, and this figure is about the line — cut by it, the sheet read the
   * daily limit ("$1,000") as what could be borrowed.
   */
  availableToBorrow: string;
  /** "5.57%" — the borrow rate, compounded to an annual figure. */
  borrowApy: string;
  /** 0–1, for the drawn-down track. */
  borrowedProgress: number;

  /** The figure under each segment name in the control. */
  segmentValue: Record<SpendMode, string>;

  /** Whether there is a loan at all. What gates the Repay button. */
  hasPosition: boolean;
  /** Whether the Safe's mode can draw on credit at all. False for every v1 cardholder. */
  canBorrow: boolean;
  /**
   * Whether the card screen shows the borrow-position card.
   *
   * It used to be {@link hasPosition}, which meant the card only ever appeared to someone
   * who had already borrowed — so a cardholder on Credit had no way to see the line they
   * were about to spend against, and the first thing they learned about their own credit
   * was a declined tap. A line worth naming is worth showing before it is drawn.
   *
   * Still hidden in two cases, because both would be noise rather than information: a Cash
   * cardholder, who has no credit line and is not being sold one here, and a Safe on Credit
   * with nothing to lend against, where the card would read "$0 / $0". Debt always shows it
   * regardless of mode — a Safe switched back to Cash while still carrying a loan must not
   * hide that loan.
   */
  showsBorrowPosition: boolean;
  /** How close the position is to liquidation. `none` when there is nothing borrowed. */
  risk: BorrowRisk;
  /** The health factor as a number, or null when there is no debt to measure against. */
  healthFactor: number | null;
  /**
   * False when some escrowed collateral cannot be priced.
   *
   * Worth surfacing rather than hiding: borrowing power is understated in that state AND
   * the module refuses to liquidate, so the cardholder sees their line shrink for no
   * visible reason.
   */
  fullyPriced: boolean;

  isLoading: boolean;
}

/** Whole dollars to the 6-decimal scale every on-chain USD figure here uses. */
const usdToMicro = (dollars: number): bigint =>
  BigInt(Math.max(0, Math.round(dollars * Number(ONE_USD))));

/**
 * The spend-mode surfaces' single source of figures.
 *
 * Composed here rather than in each sheet so the card screen, the mode picker and the
 * borrow-position sheet cannot show three different answers to the same question — they
 * render the same numbers on three different backgrounds, which is exactly the case where
 * independently derived values drift.
 *
 * Every figure is on-chain, read through `useCardSpendRegistration`, rather than recomputed
 * from parts. A quote the app derives itself is a quote that can disagree with what the
 * spend would actually do.
 *
 * The credit figures come from `SolidSpendLens` rather than from `SolidCashModuleV2`
 * directly, and that distinction is the whole reason the Credit sheet shows anything at all:
 * the module can only value collateral it has already ESCROWED, and it escrows nothing until
 * the first credit spend. The lens adds `prospectiveCollateralUsd` — the Safe's loose balance
 * at the ratio a lock would use — which is what a cardholder considering Credit for the first
 * time actually has.
 */
export const useSpendModeFigures = (): SpendModeFigures => {
  const {
    mode,
    canChangeMode,
    pendingMode,
    position,
    borrowApyPerSecond,
    isLoading: isRegistrationLoading,
  } = useCardSpendRegistration();

  const { data: cashBalanceUsd, isLoading: isBalanceLoading } = useCardSpendableBalanceUSD();

  return useMemo(() => {
    const cashMicro = usdToMicro(cashBalanceUsd);
    const debt = position?.debtUsd ?? 0n;

    // The whole line, and the reason the card no longer reads "$0 / $0" for a cardholder
    // holding soUSD.
    //
    // Two halves, because collateral reaches the module in two states. `borrowingPowerUsd`
    // weights what is already ESCROWED — empty until the first credit spend, since that is
    // when `spendCredit` locks anything — and `prospectivePowerUsd` weights what is still
    // LOOSE in the Safe, at the same buffered ratio the lock would use. Showing only the
    // first quoted a line of zero to everyone who had not borrowed yet, which is precisely
    // the population being asked to consider Credit.
    //
    // Gross, and deliberately not `debt + something`: the module checks power against total
    // debt, so it already covers what has been drawn.
    const creditLine = (position?.borrowingPowerUsd ?? 0n) + (position?.prospectivePowerUsd ?? 0n);

    // What is left of the line: the lens's borrowable figure without the rolling spending
    // limit, which caps the card in every mode — the cash figure is not cut by it either.
    // Cut by it here alone, Credit read as the daily limit ("$1,000") beside a far larger
    // line. Still clamped by both debt caps, so it never quotes debt the module would refuse.
    const creditHeadroom = position?.creditHeadroomUsd ?? 0n;
    const apy = borrowApyPercent(borrowApyPerSecond);
    // Cash draws on the balance and nothing else, so there is no line to speak of. Both of
    // the other modes can end a transaction in debt — Smart only sometimes, but "sometimes"
    // is still a position the cardholder owns and should be able to look at.
    const canBorrow = mode === 'credit' || mode === 'smart';

    const cashLabel = formatUsd(cashMicro);
    const availableLabel = formatUsd(creditHeadroom);

    return {
      mode,
      canChangeMode,
      pendingMode,

      cashBalance: cashLabel,
      borrowed: formatUsd(debt),
      // What the cardholder's collateral backs, drawn or not — which is what the
      // "borrowed / limit" pair means. Deliberately the collateral-derived figure rather
      // than `debt + available`: the latter is clamped by the rolling spend limits, so the
      // advertised credit line would shrink every time the cardholder bought lunch on
      // debit, which is not what a limit means to anyone reading it.
      creditLimit: formatUsd(creditLine),
      availableToBorrow: availableLabel,
      borrowApy: formatApy(apy),
      // Against the same line rendered beside it, so the bar and the figures agree.
      borrowedProgress: borrowedProgress(debt, creditLine),

      segmentValue: {
        // The design's empty state: a cardholder with nothing to spend is told what to do
        // rather than shown a zero.
        cash: cashMicro > 0n ? cashLabel : 'Add USDC',
        credit: availableLabel,
        // `max`, not a sum — and the same rule the authorize path applies. One transaction
        // takes exactly one path, so the most Smart can fund is the larger of the two; the
        // two figures also overlap heavily, both deriving from the same balance, so adding
        // them would quote money the Safe does not have.
        smart: formatUsd(cashMicro > creditHeadroom ? cashMicro : creditHeadroom),
      },

      hasPosition: debt > 0n,
      canBorrow,
      // Including the debt case: a position that exists is shown whatever the mode is now.
      showsBorrowPosition: debt > 0n || (canBorrow && creditLine > 0n),
      risk: position ? borrowRisk(position.healthFactorWad, debt) : ('none' as BorrowRisk),
      healthFactor: position ? healthFactorToNumber(position.healthFactorWad) : null,
      fullyPriced: position?.fullyPriced ?? true,

      isLoading: isRegistrationLoading || isBalanceLoading,
    };
  }, [
    mode,
    canChangeMode,
    pendingMode,
    position,
    borrowApyPerSecond,
    cashBalanceUsd,
    isRegistrationLoading,
    isBalanceLoading,
  ]);
};

export default useSpendModeFigures;
