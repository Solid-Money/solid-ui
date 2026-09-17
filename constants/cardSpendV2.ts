import { ADDRESSES, EXPO_PUBLIC_CARD_SPEND_V2 } from '@/lib/config';

import type { SpendMode } from '@/components/Card/NewCardDetails/SpendMode/spendModes';
import type { Address } from 'viem';

/**
 * Client-side constants for card spend v2 — the module that adds the Credit and Smart
 * funding modes on top of v1's cash-only spending.
 *
 * USD figures are 6-decimal integers exactly as in v1 (`CASH_USD_DECIMALS`). The health
 * factor, LTV and the interest index are WAD (1e18), which is a different scale on the
 * same wire, so the two are never mixed in one helper here.
 */

/** Health factor, LTV and the interest index are all 1e18 on-chain. */
export const WAD = 10n ** 18n;

/**
 * `Mode` as the contract numbers it. **Append-only, and the order is load-bearing** —
 * the module's own `_modeRank` is a cast of this enum, and the mode-switch delay rule is
 * "delayed iff the rank rises". A member inserted rather than appended would silently
 * re-rank every mode after it.
 */
export enum ContractSpendMode {
  /** The asset is SOLD. Tokens move Safe -> settlement treasury. */
  Debit = 0,
  /** The asset is LOCKED. Collateral moves Safe -> module escrow and USD debt is booked. */
  Credit = 1,
  /** Both paths permitted; the backend chooses per transaction. */
  Smart = 2,
}

/**
 * The app's name for a mode, given the contract's.
 *
 * "Cash" rather than "Debit" throughout the UI: the module's word describes what happens
 * to the asset, and the cardholder's question is what they are spending.
 */
const MODE_FROM_CONTRACT: Record<ContractSpendMode, SpendMode> = {
  [ContractSpendMode.Debit]: 'cash',
  [ContractSpendMode.Credit]: 'credit',
  [ContractSpendMode.Smart]: 'smart',
};

const MODE_TO_CONTRACT: Record<SpendMode, ContractSpendMode> = {
  cash: ContractSpendMode.Debit,
  credit: ContractSpendMode.Credit,
  smart: ContractSpendMode.Smart,
};

/**
 * Narrows a raw on-chain mode to the app's union.
 *
 * Anything unrecognised falls back to `cash`, which is the conservative answer in the one
 * direction that matters: a mode this build does not know about must not be rendered as
 * borrowing. A newer contract with a fourth mode would read as cash here rather than as a
 * credit line the app cannot actually operate.
 */
export const toSpendMode = (raw: number | bigint): SpendMode =>
  MODE_FROM_CONTRACT[Number(raw) as ContractSpendMode] ?? 'cash';

export const toContractMode = (mode: SpendMode): ContractSpendMode => MODE_TO_CONTRACT[mode];

/** Whether a mode needs the v2 module at all. Cash is what v1 already does. */
export const requiresV2 = (mode: SpendMode): boolean => mode !== 'cash';

/** Which module generation is operating a Safe, as `SolidSpendLens.cohortOf` reports it. */
export enum SpendCohort {
  /** Registered on neither module. Nothing can be spent. */
  None = 0,
  V1 = 1,
  V2 = 2,
  /**
   * Both modules enabled — the anomaly a user creates by re-enabling v1 after migrating.
   *
   * v2 refuses to act in this state, so the Safe is operated by v1 and the app must show
   * it as cash-only. It is recoverable by disabling v1, which is exactly what the
   * migration batch does.
   */
  Both = 3,
}

/** What `ADDRESSES` holds for a contract this build has no deployment for. */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

/**
 * Whether this build can actually operate v2.
 *
 * Both halves are required and they fail differently: the flag off is a deliberate dark
 * launch, while a flag on with no address is a misconfigured build. Treating either as
 * "v2 available" would offer a cardholder a mode whose transaction cannot be built.
 */
export const isCardSpendV2Configured = (): boolean =>
  EXPO_PUBLIC_CARD_SPEND_V2 &&
  ADDRESSES.fuse.cashModuleV2 !== ZERO_ADDRESS &&
  ADDRESSES.fuse.spendLensV2 !== ZERO_ADDRESS;

/**
 * Whether a mode switch armed for `startTime` is still waiting.
 *
 * **Not `startTime !== 0`.** The module writes the activation instant on every up-rank
 * including a zero-delay one, so with `modeDelay` at 0 — which is how this launches — an
 * already-effective switch still leaves a non-zero timestamp behind. Reading that as
 * "pending" would show a countdown for a mode the cardholder is already in.
 */
export const isModeSwitchPending = (startTimeSeconds: bigint | number): boolean => {
  const startTime = Number(startTimeSeconds);
  return startTime > 0 && startTime > Math.floor(Date.now() / 1000);
};

/**
 * A WAD health factor as the number a person reads, or null when there is no debt.
 *
 * The module reports `type(uint256).max` for a position carrying no debt, which is not a
 * ratio and must not be rendered as one — there is nothing at risk, so there is no figure
 * to show.
 */
export const healthFactorToNumber = (wad: bigint): number | null => {
  // Anything at or above this is the module's infinity sentinel rather than a real ratio.
  // Compared rather than equality-checked because interest accrual can leave the reported
  // value a hair under the sentinel on a position whose debt has just been cleared.
  if (wad >= 2n ** 255n) return null;
  return Number((wad * 10_000n) / WAD) / 10_000;
};

/**
 * How close a position is to liquidation, for the "At risk" panel.
 *
 * The thresholds are presentation, not protocol: the contract liquidates below 1.0 and
 * knows nothing about "caution". Warning early is the point — a cardholder who only learns
 * at 1.0 learns when it is already happening.
 */
export type BorrowRisk = 'none' | 'caution' | 'at-risk';

export const borrowRisk = (healthFactorWad: bigint, debtUsd: bigint): BorrowRisk => {
  if (debtUsd === 0n) return 'none';

  const hf = healthFactorToNumber(healthFactorWad);
  if (hf === null) return 'none';
  if (hf < 1.05) return 'at-risk';
  if (hf < 1.25) return 'caution';
  return 'none';
};

/**
 * A per-second WAD borrow rate as an annual percentage.
 *
 * Compounded, not multiplied: `_accrue` multiplies the *current* index by `1 + r*dt`, so
 * successive accruals compound and the realised annual figure is `e^(r * 365 days) - 1`.
 * Quoting `r * 365 days` would understate a high rate materially — at the module's own
 * ceiling it reads 100% where the cardholder actually pays ~171%.
 */
export const borrowApyPercent = (ratePerSecondWad: bigint): number => {
  if (ratePerSecondWad <= 0n) return 0;

  const perSecond = Number(ratePerSecondWad) / Number(WAD);
  const yearly = Math.expm1(perSecond * 365 * 24 * 60 * 60);
  return Number.isFinite(yearly) ? yearly * 100 : 0;
};

/** "5.57%" — two decimals, matching how the rate is quoted in the sheets. */
export const formatApy = (percent: number): string => `${percent.toFixed(2)}%`;

/**
 * How much of the credit line is drawn, as 0–1, for the progress track.
 *
 * The denominator is the whole line — the same figure rendered beside the bar — so the
 * track and the "$X / $Y" above it can never tell different stories. It used to be
 * `debt + availableToBorrow` on the belief that borrowing power is what remains after debt
 * is deducted; it is not. `SolidCashModuleV2` compares power against TOTAL debt
 * (`if (_debtOf($) > power) revert ExceedsBorrowingPower()`), so power already covers what
 * has been drawn, and adding debt back to it counted the drawn part twice.
 *
 * Clamped because a position that has moved past its own line (interest accrued, or
 * collateral repriced down) must render as full rather than overflow the track.
 */
export const borrowedProgress = (debtUsd: bigint, creditLineUsd: bigint): number => {
  if (creditLineUsd <= 0n) return 0;

  const ratio = Number((debtUsd * 10_000n) / creditLineUsd) / 10_000;
  return Math.min(1, Math.max(0, ratio));
};
