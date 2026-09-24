import { useCallback, useState } from 'react';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, encodeFunctionData } from 'viem';
import { fuse } from 'viem/chains';

import {
  CASH_USD_DECIMALS,
  getDeviceTimezoneOffsetSeconds,
  MONTHLY_LIMIT_MULTIPLIER,
  onChainToUsd,
  spendLimitRejection,
  usdToOnChain,
} from '@/constants/cardSpendModule';
import {
  isCardSpendV2Configured,
  isModeSwitchPending,
  SpendCohort,
  toContractMode,
  toSpendMode,
} from '@/constants/cardSpendV2';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardProvider } from '@/hooks/useCardProvider';
import useUser from '@/hooks/useUser';
import { Safe_ABI } from '@/lib/abis/Safe';
import { SolidCashModule_ABI } from '@/lib/abis/SolidCashModule';
import { SolidCashModuleV2_ABI } from '@/lib/abis/SolidCashModuleV2';
import { SolidSpendLens_ABI } from '@/lib/abis/SolidSpendLens';
import { track } from '@/lib/analytics';
import { confirmWirexCardRegistration } from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { CardProvider } from '@/lib/types';
import { publicClient } from '@/lib/wagmi';
import { useUserStore } from '@/store/useUserStore';

import type { SpendMode } from '@/components/Card/NewCardDetails/SpendMode/spendModes';

export const CARD_SPEND_REGISTRATION_QUERY_KEY = 'cardSpendRegistration';

const MODULE = ADDRESSES.fuse.cashModule;
const MODULE_V2 = ADDRESSES.fuse.cashModuleV2;
const SPEND_LENS_V2 = ADDRESSES.fuse.spendLensV2;

/**
 * Head of a Safe's module linked list. `disableModule(prevModule, module)` needs the
 * entry pointing at the one being removed, and for the most recently enabled module
 * that pointer is the sentinel itself rather than another module's address.
 */
const SENTINEL_MODULES = '0x0000000000000000000000000000000000000001' as Address;

/** Enough to cover any real Safe's module list in one read. */
const MODULE_PAGE_SIZE = 50n;

/**
 * Where a registration or limit change was started from, for the funnel.
 *
 * `card_reveal` is the gate on the card-details reveal: a card whose Safe cannot be
 * debited declines every payment, so "Show details" opens the spending sheet instead of
 * handing over the PAN. Worth telling apart from `spending_sheet` — someone who came
 * looking for their card number is being asked a question they did not go there to
 * answer, and how many of them finish it is the thing to watch.
 *
 * `spending_banner` is the "Card spending isn't set up" row on the card pane, shown to a Safe that
 * set up card spending and then had its module turned off. It only ever re-enables.
 */
export type CardSpendRegistrationSource =
  | 'spending_sheet'
  | 'card_activation'
  | 'card_reveal'
  | 'spending_banner';

/** The Safe's live limit state, with every matured transition already applied. */
export interface CardSpendLimit {
  dailyLimitUsd: bigint;
  monthlyLimitUsd: bigint;
  spentTodayUsd: bigint;
  spentThisMonthUsd: bigint;
  /**
   * Unix seconds the daily window resets on, at which point `spentTodayUsd` goes back to
   * zero. Recomputed by the module on every read, so it is always the *next* reset.
   */
  dailyRenewalTimestamp: bigint;
  /** Unix seconds the monthly window resets on. */
  monthlyRenewalTimestamp: bigint;
  /** The offset the rolling windows reset on. Written at registration, no setter. */
  timezoneOffset: number;
}

/**
 * A move of a Safe's caps, in whole dollars.
 *
 * Both halves are optional, and an omitted one is left exactly as stored: the caps are
 * independent decisions, so editing one never moves the other.
 */
export interface CardSpendLimitChange {
  dailyLimitUsd?: number;
  monthlyLimitUsd?: number;
}

/**
 * A limit increase that has been requested but has not matured yet.
 *
 * Only ever non-null while the raise is still pending: `applicableSpendingLimit` folds a
 * matured increase into the live limits and zeroes the activation time, so this is
 * exactly "asked for, not in force".
 */
export interface PendingLimitIncrease {
  dailyLimitUsd: bigint;
  monthlyLimitUsd: bigint;
  /** Unix seconds. The increase is in force on the first block after this. */
  activatesAt: bigint;
}

/** What the setup sheet needs to render, all read from the chain in one multicall. */
export interface CardSpendRegistration {
  /** Both halves done — module enabled on the Safe *and* the Safe registered. */
  registered: boolean;
  /**
   * The raw `isRegistered` flag, kept separate from {@link registered}.
   *
   * These come apart in a state the UI has to handle: registration is permanent
   * (`registerSafe` reverts `AlreadyRegistered` and there is no deregister), but module
   * consent can be withdrawn at any time. A Safe that registered and then disabled the
   * module is `registeredOnChain` yet not `registered`, and the fix is to re-enable the
   * module — not to register again, which cannot succeed.
   */
  registeredOnChain: boolean;
  moduleEnabled: boolean;
  /** Live org ceilings. A chosen limit above either of these reverts. */
  maxDailyLimitUsd: bigint;
  maxMonthlyLimitUsd: bigint;
  defaultDailyLimitUsd: bigint;
  defaultMonthlyLimitUsd: bigint;
  /**
   * Hard cap on one card transaction, independent of the rolling windows.
   *
   * Configured equal to the org's daily ceiling, so in normal operation it cannot bind
   * before the daily limit does and the sheet does not name it. Still read on every load:
   * lowering it is a live ops throttle, and a cap that does bind has to be visible.
   */
  maxPerTxUsd: bigint;
  /** Global guardian pause — spending is off for everyone while true. */
  modulePaused: boolean;
  /** Per-Safe guardian pause: arrears or a fraud hold. */
  safePaused: boolean;
  /** This Safe's caps and what has been spent against them. Zeroed until registered. */
  limit: CardSpendLimit;
  /** A requested raise still inside its delay window, or null. */
  pendingIncrease: PendingLimitIncrease | null;
  /** How long a requested increase waits before it takes effect, in seconds. */
  limitRaiseDelaySeconds: number;

  // ---- Which module generation, and what it adds -------------------------------------
  //
  // Everything above is read from whichever module actually operates this Safe, so the
  // limit flows work unchanged across a migration. Everything below says which one that
  // was and what it can additionally do.

  /** Which module generation operates this Safe right now. */
  cohort: SpendCohort;
  /**
   * The module every write here must target.
   *
   * Carried rather than derived at each call site: a Safe's generation is chain state that
   * can change under a sheet left open, and a write sent to the module the user is no
   * longer on reverts. One field, read fresh before every signature.
   */
  moduleAddress: Address;
  /**
   * How the card is funded today.
   *
   * Always `cash` for a v1 cardholder, which is the whole of what v1 does — and the
   * migration is deliberately invisible to them until they ask for a mode v1 cannot serve.
   */
  mode: SpendMode;
  /**
   * A mode switch that is armed but has not taken effect, or null.
   *
   * Only ever set for a switch to a *wider* mode: narrowing applies immediately. Null
   * whenever the activation instant has already passed, which at the launch configuration
   * of `modeDelay = 0` is immediately.
   */
  pendingMode: SpendMode | null;
  /** Unix seconds {@link pendingMode} takes effect. Zero when nothing is armed. */
  modeActivatesAt: number;
  /** How long a switch to a wider mode waits, in seconds. Zero at launch. */
  modeDelaySeconds: number;
  /** The Safe's credit position, or null for a cardholder on v1. */
  position: CardBorrowPosition | null;
  /** WAD borrow rate per second. Zero when v2 is not readable. */
  borrowApyPerSecond: bigint;
  /**
   * Whether v2 could be reached at all — configured, deployed and responding.
   *
   * What gates offering Credit and Smart. False means this build cannot execute those
   * modes, so it must not present them as choices.
   */
  v2Available: boolean;
}

/**
 * Encoders that pick the module generation's ABI from the address being written to.
 *
 * The two generations share these function names and signatures exactly, which is what
 * lets one limit flow serve both — but they are different ABI objects, and `viem` needs
 * the right one. Branching here rather than at each call site means a new write path
 * cannot forget: there is no way to build one of these calls without saying which module
 * it is for.
 */
const isV2Module = (moduleAddress: Address): boolean =>
  moduleAddress.toLowerCase() === MODULE_V2.toLowerCase();

const encodeRegisterSafe = (
  moduleAddress: Address,
  daily: bigint,
  monthly: bigint,
  timezoneOffset: bigint,
) =>
  isV2Module(moduleAddress)
    ? encodeFunctionData({
        abi: SolidCashModuleV2_ABI,
        functionName: 'registerSafe',
        args: [daily, monthly, timezoneOffset],
      })
    : encodeFunctionData({
        abi: SolidCashModule_ABI,
        functionName: 'registerSafe',
        args: [daily, monthly, timezoneOffset],
      });

const encodeLimitChange = (
  moduleAddress: Address,
  isIncrease: boolean,
  daily: bigint,
  monthly: bigint,
) => {
  const functionName = isIncrease ? 'requestSpendingLimitIncrease' : 'decreaseSpendingLimit';
  return isV2Module(moduleAddress)
    ? encodeFunctionData({ abi: SolidCashModuleV2_ABI, functionName, args: [daily, monthly] })
    : encodeFunctionData({ abi: SolidCashModule_ABI, functionName, args: [daily, monthly] });
};

const encodeCancelPendingIncrease = (moduleAddress: Address) =>
  isV2Module(moduleAddress)
    ? encodeFunctionData({
        abi: SolidCashModuleV2_ABI,
        functionName: 'cancelPendingSpendingLimitIncrease',
      })
    : encodeFunctionData({
        abi: SolidCashModule_ABI,
        functionName: 'cancelPendingSpendingLimitIncrease',
      });

/**
 * The module-list entry pointing at `target`, which `Safe.disableModule` requires.
 *
 * Cannot be derived — it is a linked list and the predecessor depends on enable order — and
 * passing the wrong one reverts GS103. Read at press time rather than cached with the rest
 * of the registration, because enabling any other module rewrites these pointers.
 *
 * Null when the module is not on the list at all, which means the chain disagrees with what
 * was read a moment ago and there is nothing to disable.
 */
const findModulePredecessor = async (
  safeAddress: Address,
  target: Address,
): Promise<Address | null> => {
  const client = publicClient(fuse.id);
  const [modules] = await client.readContract({
    address: safeAddress,
    abi: Safe_ABI,
    functionName: 'getModulesPaginated',
    args: [SENTINEL_MODULES, MODULE_PAGE_SIZE],
  });

  const index = modules.findIndex(
    entry => entry.toLowerCase() === (target as string).toLowerCase(),
  );
  if (index === -1) return null;

  // `getModulesPaginated` walks from the sentinel outwards, so the entry before the target
  // in this array is exactly the one pointing at it — and for the first entry that is the
  // sentinel itself.
  return index === 0 ? SENTINEL_MODULES : modules[index - 1];
};

/**
 * The caps a migrating Safe registers on v2 with.
 *
 * Carried from what the cardholder already chose on v1 rather than reset to v2's defaults:
 * they picked those numbers, and a migration they were never shown must not silently move
 * them. Clamped *down* where v2's org ceilings are tighter, because `registerSafe` reverts
 * on a cap above them and a revert here fails the whole batch.
 *
 * The monthly is clamped first and the daily then clamped to it, because `SpendingLimitLib`
 * rejects a daily above the monthly outright — clamping the two independently against
 * different ceilings can produce exactly that pair.
 *
 * A zero cap falls back to v2's default. It should not happen for a registered Safe, but
 * registering at zero would produce a card that declines every payment, which is a worse
 * outcome than a default nobody picked.
 */
const carriedLimits = (
  current: CardSpendLimit,
  v2: Pick<
    V2State,
    'maxDailyLimitUsd' | 'maxMonthlyLimitUsd' | 'defaultDailyLimitUsd' | 'defaultMonthlyLimitUsd'
  >,
) => {
  const min = (a: bigint, b: bigint) => (a < b ? a : b);

  const monthly = min(
    current.monthlyLimitUsd > 0n ? current.monthlyLimitUsd : v2.defaultMonthlyLimitUsd,
    v2.maxMonthlyLimitUsd,
  );
  const daily = min(
    min(
      current.dailyLimitUsd > 0n ? current.dailyLimitUsd : v2.defaultDailyLimitUsd,
      v2.maxDailyLimitUsd,
    ),
    monthly,
  );

  return {
    dailyLimitUsd: daily,
    monthlyLimitUsd: monthly,
    // Written once at registration with no setter, so carrying it keeps the cardholder's
    // rolling windows resetting on the day they actually experience.
    timezoneOffset: current.timezoneOffset,
  };
};

/**
 * A Safe's credit position, as v2 values it. Null for a cardholder still on v1, which has
 * no notion of collateral or debt at all.
 */
export interface CardBorrowPosition {
  /** Escrowed collateral at the module's own bounded price. */
  collateralUsd: bigint;
  /**
   * Borrowing power from collateral **already escrowed**, weighted by each token's LTV.
   *
   * Zero for every cardholder who has not borrowed yet, and that is correct rather than a
   * gap: the module only escrows at `spendCredit` time, so before the first credit spend
   * `collateralOf` is empty for every token and `positionValue` has nothing to weight. It
   * is NOT the line a cardholder can draw on — see {@link prospectivePowerUsd}.
   *
   * Gross, not net. The module compares it against TOTAL debt
   * (`if (_debtOf($) > power) revert ExceedsBorrowingPower()`), so it already covers what
   * has been drawn; subtracting debt from it a second time would understate the line.
   */
  borrowingPowerUsd: bigint;
  /**
   * Borrowing power the Safe's **loose** balance would add if it were locked, from
   * `SolidSpendLens.prospectiveCollateralUsd`.
   *
   * This is the half that makes the figure mean anything before the first borrow. It is
   * the one number the lens computes that the module has no equivalent for, and it is
   * quoted at `effectiveTargetLtv` — `ltv * targetLtvBps / MAX_BPS`, the same buffered
   * ratio `spendCredit` locks at — so a quote can never advertise more power than
   * execution would actually back. Expect it to read below `balance * maxLTV`.
   */
  prospectivePowerUsd: bigint;
  /** Collateral weighted by each liquidation threshold: what could be seized. */
  liquidationCapacityUsd: bigint;
  /** Outstanding debt including accrued interest. */
  debtUsd: bigint;
  /**
   * What could be borrowed right now, from `SolidSpendLens.availableToBorrowUsd`.
   *
   * Not `power - debt`: the lens has already clamped it by the per-Safe debt cap, the
   * global debt cap and the Safe's remaining spending limit. Those are the same clamps
   * the authorize path applies, so this is the only figure that can honestly be shown as
   * "you can spend this on credit" — anything derived from collateral alone would quote a
   * number a card tap then declines.
   */
  availableToBorrowUsd: bigint;
  /**
   * What the credit line leaves to draw: {@link availableToBorrowUsd} without the Safe's
   * rolling spending limit.
   *
   * Still clamped by the per-Safe and global debt caps, which bound borrowing itself. The
   * spending limit bounds the card instead, so it binds every mode alike — the cash figure
   * beside this one is not reduced by it either, and a credit figure that was would quote the
   * daily limit as if it were the line.
   */
  creditHeadroomUsd: bigint;
  /** WAD. The module reports `type(uint256).max` when there is no debt. */
  healthFactorWad: bigint;
  /**
   * False when any escrowed collateral cannot be strictly priced.
   *
   * Worth surfacing rather than hiding: in that state borrowing power is understated AND
   * the module refuses to liquidate the position, so the user sees an unexplained shrink
   * in their line while nothing looks broken.
   */
  fullyPriced: boolean;
}

/** Everything v2 answers about a Safe. Null when v2 is not configured or cannot be read. */
interface V2State {
  registeredOnChain: boolean;
  moduleEnabled: boolean;
  /** v1 still enabled on this Safe, which makes v2 inert — `COHORT_BOTH`. */
  legacyEnabled: boolean;
  modulePaused: boolean;
  safePaused: boolean;
  maxPerTxUsd: bigint;
  maxDailyLimitUsd: bigint;
  maxMonthlyLimitUsd: bigint;
  defaultDailyLimitUsd: bigint;
  defaultMonthlyLimitUsd: bigint;
  limitRaiseDelaySeconds: number;
  /** How long a switch to a wider mode waits. Zero at launch, but never assumed to be. */
  modeDelaySeconds: number;
  rawLimit: RawSpendingLimit;
  mode: SpendMode;
  incomingMode: SpendMode;
  incomingModeStartTime: number;
  position: CardBorrowPosition;
  borrowApyPerSecond: bigint;
}

/** The `SpendingLimit` tuple, identical in both module generations. */
type RawSpendingLimit = {
  dailyLimit: bigint;
  monthlyLimit: bigint;
  spentToday: bigint;
  spentThisMonth: bigint;
  pendingDailyLimit: bigint;
  pendingMonthlyLimit: bigint;
  dailyRenewalTimestamp: bigint;
  monthlyRenewalTimestamp: bigint;
  dailyLimitActivationTime: bigint;
  monthlyLimitActivationTime: bigint;
  timezoneOffset: bigint;
};

/**
 * The `credit` half of `SolidSpendLens.availableToSpend`, or undefined when the lens could
 * not be read.
 *
 * Narrowed by hand rather than typed off the ABI, because the surrounding multicall is
 * already `as never[]`-shaped and only part of the struct is wanted here. Every access is
 * guarded: a lens at the wrong address can answer a shape that decodes but means something
 * else, and that has to degrade to "no lens" rather than let a confident `undefined` reach a
 * figure the cardholder reads as their credit line.
 */
const lensCredit = (
  result: { status: string; result?: unknown } | undefined,
):
  | {
      collateralUsd: bigint;
      borrowingPowerUsd: bigint;
      liquidationCapacityUsd: bigint;
      debtUsd: bigint;
      availableToBorrowUsd: bigint;
      prospectiveCollateralUsd: bigint;
      fullyPriced: boolean;
    }
  | undefined => {
  if (result?.status !== 'success') return undefined;

  const credit = (result.result as { credit?: Record<string, unknown> } | undefined)?.credit;
  if (!credit) return undefined;

  const amount = (key: string): bigint | undefined =>
    typeof credit[key] === 'bigint' ? (credit[key] as bigint) : undefined;

  const borrowingPowerUsd = amount('borrowingPowerUsd');
  const prospectiveCollateralUsd = amount('prospectiveCollateralUsd');
  const availableToBorrowUsd = amount('availableToBorrowUsd');
  const debtUsd = amount('debtUsd');

  // The four that the line is actually made of. If any is missing the struct is not the one
  // this code was written against, and half a credit line is worse than none.
  if (
    borrowingPowerUsd === undefined ||
    prospectiveCollateralUsd === undefined ||
    availableToBorrowUsd === undefined ||
    debtUsd === undefined
  ) {
    return undefined;
  }

  return {
    collateralUsd: amount('collateralUsd') ?? 0n,
    borrowingPowerUsd,
    liquidationCapacityUsd: amount('liquidationCapacityUsd') ?? 0n,
    debtUsd,
    availableToBorrowUsd,
    prospectiveCollateralUsd,
    fullyPriced: credit.fullyPriced !== false,
  };
};

/**
 * The lens's borrowable figure with the rolling spending limit taken back out.
 *
 * Re-applies the lens's other clamps rather than trying to undo one: collateral headroom,
 * then the per-Safe debt cap, then the global cap's remaining room. The lens figure is a floor
 * because it can only be lower, except under a limits waiver — which lifts the per-Safe cap
 * here too, and which only the lens knows about.
 */
const creditHeadroom = (
  credit: NonNullable<ReturnType<typeof lensCredit>>,
  caps: { maxDebtPerSafeUsd: bigint; maxGlobalDebtUsd: bigint },
  totalDebtUsd: bigint,
): bigint => {
  const room = (cap: bigint, used: bigint) => (cap > used ? cap - used : 0n);
  const min = (a: bigint, b: bigint) => (a < b ? a : b);

  const line = credit.borrowingPowerUsd + credit.prospectiveCollateralUsd;
  const headroom = min(
    min(room(line, credit.debtUsd), room(caps.maxDebtPerSafeUsd, credit.debtUsd)),
    room(caps.maxGlobalDebtUsd, totalDebtUsd),
  );

  return headroom > credit.availableToBorrowUsd ? headroom : credit.availableToBorrowUsd;
};

/**
 * v2's answer for this Safe, or null when there is nothing to ask.
 *
 * `allowFailure` is on and any failed call collapses the whole thing to null, which is
 * deliberately blunt: a partially-read v2 cannot be reasoned about — half of these decide
 * whether the Safe is even operated by v2 — and falling back to v1 is always safe because
 * v1 is where every cardholder already is. An address that is not a contract yet, a
 * mis-set env override and a node hiccup all land here and all degrade the same way.
 */
const readV2State = async (safeAddress: Address): Promise<V2State | null> => {
  if (!isCardSpendV2Configured()) return null;

  const client = publicClient(fuse.id);
  const module = { address: MODULE_V2, abi: SolidCashModuleV2_ABI } as const;

  try {
    const results = await client.multicall({
      allowFailure: true,
      contracts: [
        { ...module, functionName: 'isRegistered', args: [safeAddress] },
        { ...module, functionName: 'isModuleEnabledOn', args: [safeAddress] },
        // v2 goes inert while v1 is still enabled, so this is what tells a half-migrated
        // Safe apart from a migrated one.
        { ...module, functionName: 'isLegacyEnabledOn', args: [safeAddress] },
        { ...module, functionName: 'isPaused' },
        { ...module, functionName: 'safePaused', args: [safeAddress] },
        // Both of these live in the setters half and resolve through the core's fallback.
        { ...module, functionName: 'getParams' },
        { ...module, functionName: 'applicableSpendingLimit', args: [safeAddress] },
        { ...module, functionName: 'getMode', args: [safeAddress] },
        { ...module, functionName: 'getIncomingMode', args: [safeAddress] },
        { ...module, functionName: 'incomingModeStartTime', args: [safeAddress] },
        { ...module, functionName: 'debtUsd', args: [safeAddress] },
        { ...module, functionName: 'healthFactor', args: [safeAddress] },
        { ...module, functionName: 'positionValue', args: [safeAddress] },
        { ...module, functionName: 'maxCanSpendUsd', args: [safeAddress] },
        { ...module, functionName: 'borrowApyPerSecond' },
        // For the global debt cap's remaining room, which bounds the credit headroom below.
        { ...module, functionName: 'totalDebtUsd' },
        // The lens, for the credit figures the module cannot answer on its own — above all
        // `prospectiveCollateralUsd`, the power the Safe's LOOSE balance would give it.
        // Without this the card offered Credit at $0 to a cardholder holding soUSD, because
        // `positionValue` only weights what has already been escrowed and nothing is escrowed
        // until the first credit spend. Last in the list so the fixed indices above are
        // untouched, and read separately below so a lens that cannot be reached costs only the
        // credit figures rather than collapsing the whole read.
        {
          address: SPEND_LENS_V2,
          abi: SolidSpendLens_ABI,
          functionName: 'availableToSpend',
          args: [safeAddress],
        },
      ],
    });

    // The lens is the one call allowed to fail. Everything before it decides whether the Safe
    // is operated by v2 at all, so a gap there is unreasonable-about; a missing lens only
    // costs the loose-balance half of the credit line, which is worth degrading rather than
    // falling the whole Safe back to v1 for.
    const lensResult = results[results.length - 1];
    if (results.slice(0, -1).some(result => result.status !== 'success')) return null;

    const [
      registeredOnChain,
      moduleEnabled,
      legacyEnabled,
      modulePaused,
      safePaused,
      params,
      rawLimit,
      mode,
      incomingMode,
      incomingModeStartTime,
      debtUsd,
      healthFactorWad,
      positionValue,
      ,
      borrowApyPerSecond,
      totalDebtUsd,
    ] = results.map(result => result.result) as never[];

    const p = params as unknown as {
      maxPerTxUsd: bigint;
      maxDailyLimitUsd: bigint;
      maxMonthlyLimitUsd: bigint;
      defaultDailyLimitUsd: bigint;
      defaultMonthlyLimitUsd: bigint;
      limitRaiseDelay: bigint;
      modeDelay: bigint;
      maxDebtPerSafeUsd: bigint;
      maxGlobalDebtUsd: bigint;
    };
    const [powerUsd, capacityUsd, fullyPriced] = positionValue as unknown as [
      bigint,
      bigint,
      boolean,
    ];

    const debt = debtUsd as unknown as bigint;
    const credit = lensCredit(lensResult);

    return {
      registeredOnChain: registeredOnChain as unknown as boolean,
      moduleEnabled: moduleEnabled as unknown as boolean,
      legacyEnabled: legacyEnabled as unknown as boolean,
      modulePaused: modulePaused as unknown as boolean,
      safePaused: safePaused as unknown as boolean,
      maxPerTxUsd: p.maxPerTxUsd,
      maxDailyLimitUsd: p.maxDailyLimitUsd,
      maxMonthlyLimitUsd: p.maxMonthlyLimitUsd,
      defaultDailyLimitUsd: p.defaultDailyLimitUsd,
      defaultMonthlyLimitUsd: p.defaultMonthlyLimitUsd,
      limitRaiseDelaySeconds: Number(p.limitRaiseDelay),
      modeDelaySeconds: Number(p.modeDelay),
      rawLimit: rawLimit as unknown as RawSpendingLimit,
      mode: toSpendMode(mode as unknown as number),
      incomingMode: toSpendMode(incomingMode as unknown as number),
      incomingModeStartTime: Number(incomingModeStartTime as unknown as bigint),
      position: {
        // The lens prices escrowed collateral the same way the module does, so its figure is
        // preferred only because it comes with the rest of the struct; the module's is the
        // fallback when the lens could not be read.
        collateralUsd: credit?.collateralUsd ?? 0n,
        borrowingPowerUsd: credit?.borrowingPowerUsd ?? powerUsd,
        prospectivePowerUsd: credit?.prospectiveCollateralUsd ?? 0n,
        liquidationCapacityUsd: credit?.liquidationCapacityUsd ?? capacityUsd,
        debtUsd: credit?.debtUsd ?? debt,
        // Without the lens there is no honest borrowable figure: the module's power covers
        // only escrowed collateral and none of the caps, so a derived number would be wrong
        // in both directions. Zero says "we do not know" and the UI shows a line of zero
        // rather than one it cannot stand behind.
        availableToBorrowUsd: credit?.availableToBorrowUsd ?? 0n,
        // Zero without the lens for the same reason: the line it is cut from is the lens's.
        creditHeadroomUsd: credit
          ? creditHeadroom(credit, p, totalDebtUsd as unknown as bigint)
          : 0n,
        healthFactorWad: healthFactorWad as unknown as bigint,
        fullyPriced: credit?.fullyPriced ?? fullyPriced,
      },
      borrowApyPerSecond: borrowApyPerSecond as unknown as bigint,
    };
  } catch {
    // Same reasoning as the failed-call branch above: v1 is the safe fallback.
    return null;
  }
};

/**
 * Folds a matured raise into the caps, and reports one that is still waiting.
 *
 * Shared by both generations because `applicableSpendingLimit` is the same reader with the
 * same tuple in each, and because the one subtlety here must not be implemented twice: the
 * module only matures a pending increase once a block's timestamp has gone *past* the
 * activation time, so a raise signed while the delay is zero still reads as pending until
 * the chain ticks. Read back straight after the write — exactly when this runs — that would
 * report the cap the user has just replaced, for a whole block time, with no refetch due.
 *
 * So a raise whose activation instant has already passed in wall-clock terms is folded in
 * here: the only reason the reader still calls it pending is that no block has been mined
 * since, the chain agrees within one, and nothing can be spent in between that the new cap
 * would not have allowed anyway.
 */
const foldMaturedRaise = (limit: RawSpendingLimit) => {
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const activatesAt = limit.dailyLimitActivationTime;
  const isRaiseEffective = activatesAt > 0n && activatesAt <= nowSeconds;

  return {
    limit: {
      dailyLimitUsd: isRaiseEffective ? limit.pendingDailyLimit : limit.dailyLimit,
      monthlyLimitUsd: isRaiseEffective ? limit.pendingMonthlyLimit : limit.monthlyLimit,
      spentTodayUsd: limit.spentToday,
      spentThisMonthUsd: limit.spentThisMonth,
      dailyRenewalTimestamp: limit.dailyRenewalTimestamp,
      monthlyRenewalTimestamp: limit.monthlyRenewalTimestamp,
      timezoneOffset: Number(limit.timezoneOffset),
    } satisfies CardSpendLimit,
    // The daily and monthly halves of a raise are armed together with one activation
    // time, so the daily one answers for both.
    pendingIncrease:
      activatesAt > 0n && !isRaiseEffective
        ? {
            dailyLimitUsd: limit.pendingDailyLimit,
            monthlyLimitUsd: limit.pendingMonthlyLimit,
            activatesAt,
          }
        : null,
  };
};

/**
 * One multicall for everything the spending sheet decides on.
 *
 * A standalone function rather than an inline `queryFn` so the mutations can re-read
 * through `fetchQuery` right before they sign. That matters: every write here is
 * conditional on the current state (which calls to batch, whether a change is a decrease
 * or an increase), and reading that from a render closure means signing against whatever
 * was true when the sheet last rendered.
 */
const readCardSpendRegistration = async (safeAddress: Address): Promise<CardSpendRegistration> => {
  const client = publicClient(fuse.id);
  const module = { address: MODULE as Address, abi: SolidCashModule_ABI } as const;

  // Both generations in parallel, so knowing which one operates this Safe costs one round
  // trip rather than two. v2 answers null whenever it is not configured or not readable,
  // which is every cardholder today.
  const [v1, v2] = await Promise.all([
    readV1State(client, module, safeAddress),
    readV2State(safeAddress),
  ]);

  // Which module actually operates this Safe, mirroring `SolidSpendLens.cohortOf` exactly
  // — the backend routes settlement off that same rule, and the app must not disagree with
  // it about which module is live.
  //
  // `Both` is the anomaly a cardholder creates by re-enabling v1 after migrating. v2
  // refuses to act in that state, so the Safe is operated by v1 and is shown as cash-only.
  // It is self-healing: disabling v1 is exactly what the migration batch does.
  const onV2 = v2 !== null && v2.registeredOnChain && v2.moduleEnabled;
  const cohort = onV2
    ? v2.legacyEnabled
      ? SpendCohort.Both
      : SpendCohort.V2
    : v1.registered && v1.moduleEnabled
      ? SpendCohort.V1
      : SpendCohort.None;

  // Which generation's registration state to REPORT, which is not the same question as
  // which one is currently working.
  //
  // Registration on v2 is the durable fact that this Safe migrated. A migrated cardholder
  // who then revokes the v2 module has nothing working at all — but the fix is to re-enable
  // v2, not to fall back to v1, which would silently return them to cash spending and
  // strand the collateral v2 still holds for them. So a Safe that has ever registered on v2
  // keeps reporting v2.
  //
  // The exception is `Both`: with v1 re-enabled, v2 is inert and v1 genuinely operates the
  // card, so that Safe is reported as the v1 cardholder it is behaving like.
  const isV2Active = v2 !== null && v2.registeredOnChain && !v2.legacyEnabled;

  if (isV2Active && v2 !== null) {
    const folded = foldMaturedRaise(v2.rawLimit);
    // Pending only while the clock has not reached it. The module stamps an activation
    // instant on every up-rank including a zero-delay one, so `!== 0` would show a
    // countdown for a switch that already took effect — which is every switch at launch.
    const isPending = isModeSwitchPending(v2.incomingModeStartTime);

    return {
      registered: v2.registeredOnChain && v2.moduleEnabled,
      registeredOnChain: v2.registeredOnChain,
      moduleEnabled: v2.moduleEnabled,
      maxDailyLimitUsd: v2.maxDailyLimitUsd,
      maxMonthlyLimitUsd: v2.maxMonthlyLimitUsd,
      defaultDailyLimitUsd: v2.defaultDailyLimitUsd,
      defaultMonthlyLimitUsd: v2.defaultMonthlyLimitUsd,
      maxPerTxUsd: v2.maxPerTxUsd,
      modulePaused: v2.modulePaused,
      safePaused: v2.safePaused,
      limit: folded.limit,
      pendingIncrease: folded.pendingIncrease,
      limitRaiseDelaySeconds: v2.limitRaiseDelaySeconds,
      cohort,
      moduleAddress: MODULE_V2,
      mode: v2.mode,
      pendingMode: isPending ? v2.incomingMode : null,
      modeActivatesAt: isPending ? v2.incomingModeStartTime : 0,
      modeDelaySeconds: v2.modeDelaySeconds,
      position: v2.position,
      borrowApyPerSecond: v2.borrowApyPerSecond,
      v2Available: true,
    };
  }

  const folded = foldMaturedRaise(v1.rawLimit);

  return {
    registered: v1.registered && v1.moduleEnabled,
    registeredOnChain: v1.registered,
    moduleEnabled: v1.moduleEnabled,
    maxDailyLimitUsd: v1.maxDailyLimitUsd,
    maxMonthlyLimitUsd: v1.maxMonthlyLimitUsd,
    defaultDailyLimitUsd: v1.defaultDailyLimitUsd,
    defaultMonthlyLimitUsd: v1.defaultMonthlyLimitUsd,
    maxPerTxUsd: v1.maxPerTxUsd,
    modulePaused: v1.modulePaused,
    safePaused: v1.safePaused,
    limit: folded.limit,
    pendingIncrease: folded.pendingIncrease,
    limitRaiseDelaySeconds: v1.limitRaiseDelaySeconds,
    cohort,
    moduleAddress: MODULE as Address,
    // v1 has exactly one way to fund a card, and the cardholder is not told there are
    // others until they can actually have them.
    mode: 'cash',
    pendingMode: null,
    modeActivatesAt: 0,
    modeDelaySeconds: v2?.modeDelaySeconds ?? 0,
    position: null,
    borrowApyPerSecond: v2?.borrowApyPerSecond ?? 0n,
    v2Available: v2 !== null,
  };
};

/** v1's answer for this Safe. Always read: it is where every cardholder starts. */
const readV1State = async (
  client: ReturnType<typeof publicClient>,
  module: { address: Address; abi: typeof SolidCashModule_ABI },
  safeAddress: Address,
) => {
  // One multicall rather than eleven round trips: this runs on mount of the card
  // screen and the whole point of the module's lens design is that a spending
  // decision is one read.
  const [
    registered,
    moduleEnabled,
    maxDailyLimitUsd,
    maxMonthlyLimitUsd,
    defaultDailyLimitUsd,
    defaultMonthlyLimitUsd,
    maxPerTxUsd,
    modulePaused,
    safePaused,
    limit,
    limitRaiseDelay,
  ] = await client.multicall({
    allowFailure: false,
    contracts: [
      { ...module, functionName: 'isRegistered', args: [safeAddress] },
      // The module's own guarded reader, not `Safe.isModuleEnabled` directly: it
      // returns false for an address that cannot answer instead of reverting, which
      // matters because a Solid Safe may still be counterfactual.
      { ...module, functionName: 'isModuleEnabledOn', args: [safeAddress] },
      { ...module, functionName: 'maxDailyLimitUsd' },
      { ...module, functionName: 'maxMonthlyLimitUsd' },
      { ...module, functionName: 'defaultDailyLimitUsd' },
      { ...module, functionName: 'defaultMonthlyLimitUsd' },
      { ...module, functionName: 'maxPerTxUsd' },
      { ...module, functionName: 'isPaused' },
      { ...module, functionName: 'safePaused', args: [safeAddress] },
      // The same reader `spend` settles against, so the caps shown are the caps
      // enforced — including a window that has already rolled over.
      { ...module, functionName: 'applicableSpendingLimit', args: [safeAddress] },
      { ...module, functionName: 'limitRaiseDelay' },
    ],
  });

  return {
    // Deliberately kept apart rather than pre-ANDed. Registered-but-revoked is a real
    // state (the user turned the module off in a Safe client) and the caller has to be
    // able to tell it from never-registered — the fix is different for each.
    registered,
    moduleEnabled,
    maxDailyLimitUsd,
    maxMonthlyLimitUsd,
    defaultDailyLimitUsd,
    defaultMonthlyLimitUsd,
    maxPerTxUsd,
    modulePaused,
    safePaused,
    rawLimit: limit as unknown as RawSpendingLimit,
    limitRaiseDelaySeconds: Number(limitRaiseDelay),
  };
};

const cardSpendRegistrationQueryOptions = (
  selectedUserId: string | undefined,
  safeAddress: Address | undefined,
) => ({
  queryKey: [CARD_SPEND_REGISTRATION_QUERY_KEY, selectedUserId, safeAddress],
  queryFn: () => readCardSpendRegistration(safeAddress!),
  retry: false,
  staleTime: 15_000,
});

/**
 * The chain state a write is about to be built from, always read fresh.
 *
 * `staleTime: 0` on purpose: the cached copy is good enough to render with, but every
 * mutation here branches on it — whether to include `enableModule`, whether a chosen
 * limit is a decrease or an increase — and each of those branches reverts if the chain
 * has moved. One extra multicall is cheaper than a failed user operation.
 */
const readFresh = (
  queryClient: QueryClient,
  selectedUserId: string | undefined,
  safeAddress: Address,
) =>
  queryClient.fetchQuery({
    ...cardSpendRegistrationQueryOptions(selectedUserId, safeAddress),
    staleTime: 0,
  });

interface UseCardSpendRegistrationOptions {
  /**
   * Read the chain even before the issuer is known.
   *
   * By default this only runs for a Wirex cardholder, which is right everywhere a card
   * already exists. The activation screen is the exception: it registers the module in
   * the same press that creates the card, so the read has to have happened *before*
   * there is a card to resolve an issuer from.
   */
  enabled?: boolean;
}

/**
 * A Wirex cardholder's `SolidCashModule` registration, and the actions that shape it.
 *
 * ## What registration is, and why it replaced the allowance
 *
 * This is the only Wirex card-spend flow. It replaced an ERC-20 allowance on soUSD
 * granted to our card-spend wallet, whose single bound was the approved amount: one
 * number, spendable in one transaction, with no per-transaction ceiling, no rolling
 * window, and no way for the user to see or shape what the card may take over time.
 *
 * `SolidCashModule` moves those bounds on-chain. Registering sets a daily and a monthly
 * cap for this Safe specifically, on top of the module's own per-transaction cap and the
 * live org ceilings. The backend's spender key can only ever send to an immutable
 * treasury address, only in allowlisted tokens (USDC, USDT and soUSD, drawn in that
 * order), only inside those caps, and only once per settlement id. None of that is
 * enforced by our backend — it is enforced by the contract, which is the point.
 *
 * ## Why the chain is read directly rather than trusted from the backend
 *
 * Registration status *is* on-chain state, and two independent facts have to hold: the
 * module must be enabled on the Safe, and the Safe must have registered. A user can
 * revoke the first at any time from any Safe client, with no call to us — the module
 * re-checks it on every debit, so revocation is instant. A cached backend flag would
 * report a card as working after that. So the query is a multicall against Fuse, and the
 * backend is told the outcome afterwards ({@link confirmWirexCardRegistration}) so the
 * sweep engine and support share one record without each re-deriving it.
 *
 * ## Why both calls go in one user operation
 *
 * `registerSafe` requires `msg.sender` to be the Safe, and `Safe.enableModule` requires
 * `msg.sender` to be the Safe itself. Batched into a single user operation both run with
 * the Safe as sender, and the user signs once. Batching also makes it atomic: a Safe
 * cannot end up with the module enabled but unregistered, which would look like a
 * working card that declines everything.
 *
 * ## Changing the limits afterwards
 *
 * The caps are not a one-time answer. {@link updateLimit} lowers or raises them, and the
 * contract treats those two directions differently on purpose: a decrease shrinks the
 * module's authority so it lands immediately, while a raise widens what a compromised
 * backend key could take and therefore only *arms* — it matures after `limitRaiseDelay`,
 * and {@link cancelPendingIncrease} exists so the delay window is something the user can
 * actually act inside.
 */
export function useCardSpendRegistration({ enabled }: UseCardSpendRegistrationOptions = {}) {
  const { provider } = useCardProvider();
  const { user, safeAA } = useUser();
  const queryClient = useQueryClient();
  const selectedUserId = useUserStore(state => state.users.find(u => u.selected)?.userId);
  const [error, setError] = useState<string | null>(null);

  const safeAddress = user?.safeAddress as Address | undefined;
  // Wirex only: a Rain cardholder prefunds their card and has nothing to register.
  // `enabled` overrides the issuer check for the activation screen, where the card that
  // would answer the question does not exist yet.
  const isEnabled = (provider === CardProvider.WIREX || enabled === true) && Boolean(safeAddress);

  const query = useQuery<CardSpendRegistration>({
    ...cardSpendRegistrationQueryOptions(selectedUserId, safeAddress),
    enabled: isEnabled,
  });

  const registration = query.data ?? null;

  /** Everything a completed write invalidates, in one place so no path forgets one. */
  const invalidateAfterWrite = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [CARD_SPEND_REGISTRATION_QUERY_KEY] });
    // The card's spendable balance is bounded by these caps, so anything showing it is
    // stale the moment they move.
    queryClient.invalidateQueries({ queryKey: ['cardDetails'] });
  }, [queryClient]);

  /**
   * Tell the backend what the chain now says, so support and the sweep engine share one
   * record. Best-effort by design: the state is already on-chain and the query re-reads
   * the chain, so a backend that is down must not make a completed change look failed.
   */
  const confirmWithBackend = useCallback(
    async (body: {
      transactionHash: string;
      dailyLimitUsd: bigint;
      monthlyLimitUsd: bigint;
      timezoneOffset: number;
      /**
       * Which module the Safe is now registered on.
       *
       * Sent so the backend records the generation rather than inferring it from its own
       * config, which would be wrong for exactly as long as the two cohorts coexist.
       * Omitted means v1, which is what every existing caller means.
       */
      moduleAddress?: Address;
    }) => {
      try {
        await confirmWirexCardRegistration({
          transactionHash: body.transactionHash,
          dailyLimitUsd: (Number(body.dailyLimitUsd) / 10 ** CASH_USD_DECIMALS).toString(),
          monthlyLimitUsd: (Number(body.monthlyLimitUsd) / 10 ** CASH_USD_DECIMALS).toString(),
          timezoneOffset: body.timezoneOffset,
          moduleAddress: body.moduleAddress,
        });
      } catch {
        // Swallowed on purpose — see above.
      }
    },
    [],
  );

  const mutation = useMutation({
    mutationFn: async ({ dailyLimitUsd, monthlyLimitUsd }: CardSpendLimitChange) => {
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }
      if (dailyLimitUsd === undefined) throw new Error('Pick a daily limit first.');

      const fresh = await readFresh(queryClient, selectedUserId, safeAddress);
      if (fresh.registered) throw new Error('Card spending is already set up.');

      const daily = usdToOnChain(dailyLimitUsd);
      // Ten times the daily unless the caller named one, which the limit editor does when
      // the monthly row is the one the user filled in: `registerSafe` writes both caps and
      // whichever they typed is the one to write verbatim.
      const monthly =
        monthlyLimitUsd === undefined
          ? daily * MONTHLY_LIMIT_MULTIPLIER
          : usdToOnChain(monthlyLimitUsd);

      // Checked here as well as on-chain so a bad choice costs a message rather than a
      // failed user operation: the contract reverts with ExceedsOrgDailyCeiling /
      // ExceedsOrgMonthlyCeiling, which the user cannot act on. Same helper the limit
      // field validates with — an unregistered Safe's stored caps are zeros, so every
      // value is a raise and both ceilings bind. Skipped when re-enabling, where the caps
      // are already stored and are not being sent.
      if (!fresh.registeredOnChain) {
        const rejection = spendLimitRejection(
          { dailyLimitUsd: 0n, monthlyLimitUsd: 0n },
          { dailyLimitUsd: daily, monthlyLimitUsd: monthly },
          fresh,
        );
        if (rejection) throw new Error(rejection);
      }

      const timezoneOffset = getDeviceTimezoneOffsetSeconds();
      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

      // Only the calls that are actually needed — each of these reverts if its work is
      // already done, and both half-states are reachable in practice:
      //
      //  - module enabled but never registered: possible if the user enabled it in a
      //    Safe client, or if an earlier attempt was interrupted between the two.
      //    Including `enableModule` again reverts GS102.
      //  - registered but module since disabled: consent withdrawal. Registration is
      //    permanent, so including `registerSafe` again reverts `AlreadyRegistered`,
      //    and re-enabling the module is the whole fix.
      //
      // Building the batch from what is actually missing makes this one action cover
      // first-time setup and re-enabling, instead of stranding the user in either state.
      // Whichever generation this Safe belongs to. For a new cardholder that is v1, which
      // is where everyone starts; for a migrated cardholder who revoked the module it is
      // v2, and re-enabling v1 instead would silently return them to cash spending while
      // v2 still held their collateral.
      const target = fresh.moduleAddress;

      const transactions = [
        ...(fresh.moduleEnabled
          ? []
          : [
              {
                to: safeAddress,
                data: encodeFunctionData({
                  abi: Safe_ABI,
                  functionName: 'enableModule',
                  args: [target],
                }),
              },
            ]),
        ...(fresh.registeredOnChain
          ? []
          : [
              {
                to: target,
                data: encodeRegisterSafe(target, daily, monthly, BigInt(timezoneOffset)),
              },
            ]),
      ];

      if (transactions.length === 0) throw new Error('Card spending is already set up.');

      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Failed to set up card spending',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.CARD_SPEND_REGISTER_CANCELLED, { daily_limit_usd: dailyLimitUsd });
        return null;
      }

      // Re-enabling keeps the limits already stored on-chain, so report those rather
      // than the ones this call did not send.
      await confirmWithBackend({
        transactionHash: result.transactionHash,
        dailyLimitUsd: fresh.registeredOnChain ? fresh.limit.dailyLimitUsd : daily,
        monthlyLimitUsd: fresh.registeredOnChain ? fresh.limit.monthlyLimitUsd : monthly,
        timezoneOffset: fresh.registeredOnChain ? fresh.limit.timezoneOffset : timezoneOffset,
      });

      return { transactionHash: result.transactionHash, dailyLimitUsd, timezoneOffset };
    },
    onSuccess: result => {
      if (!result) return;
      invalidateAfterWrite();
      track(TRACKING_EVENTS.CARD_SPEND_REGISTER_COMPLETED, {
        daily_limit_usd: result.dailyLimitUsd,
        timezone_offset: result.timezoneOffset,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to set up card spending';
      setError(message);
      track(TRACKING_EVENTS.CARD_SPEND_REGISTER_FAILED, { error: message });
    },
  });

  /**
   * Move the caps on a Safe that is already registered.
   *
   * One entry point for both caps and both directions, because which contract call a
   * change becomes — `decreaseSpendingLimit` or `requestSpendingLimitIncrease` — is a
   * detail of how the module protects the user rather than a choice to put in front of
   * them.
   *
   * A cap the caller does not name stays exactly as stored. That keeps both on the same
   * side of the stored pair, which the contract requires (`decrease` reverts if either
   * went up, `requestIncrease` if either went down): the untouched one is equal, and
   * equal satisfies both.
   */
  const updateMutation = useMutation({
    mutationFn: async ({ dailyLimitUsd, monthlyLimitUsd }: CardSpendLimitChange) => {
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const fresh = await readFresh(queryClient, selectedUserId, safeAddress);
      if (!fresh.registeredOnChain) throw new Error('Set up card spending first.');

      // A cap the caller did not name is left exactly where it was. The two are stored
      // independently and each is a separate decision, so an edit of one must not move the
      // other — the contract only insists they stay ordered, which the rejection below
      // checks and reports rather than silently fixing.
      const current = fresh.limit;
      const nextDaily =
        dailyLimitUsd === undefined ? current.dailyLimitUsd : usdToOnChain(dailyLimitUsd);
      const nextMonthly =
        monthlyLimitUsd === undefined ? current.monthlyLimitUsd : usdToOnChain(monthlyLimitUsd);

      if (nextDaily === current.dailyLimitUsd && nextMonthly === current.monthlyLimitUsd) {
        throw new Error('Those are already your limits.');
      }

      // Checked against the caps read a moment ago rather than the ones the sheet
      // rendered with, so a ceiling the org moved in between costs a message instead of a
      // failed user operation. Same helper the field validates with, so the user never
      // meets a second, differently worded refusal after pressing Confirm.
      const rejection = spendLimitRejection(
        current,
        { dailyLimitUsd: nextDaily, monthlyLimitUsd: nextMonthly },
        fresh,
        monthlyLimitUsd === undefined ? 'daily' : 'monthly',
      );
      if (rejection) throw new Error(rejection);

      const isIncrease = nextDaily > current.dailyLimitUsd || nextMonthly > current.monthlyLimitUsd;

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        [
          {
            to: fresh.moduleAddress,
            data: encodeLimitChange(fresh.moduleAddress, isIncrease, nextDaily, nextMonthly),
          },
        ],
        isIncrease ? 'Failed to request a higher limit' : 'Failed to lower your limit',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.CARD_SPEND_LIMIT_UPDATE_CANCELLED, {
          daily_limit_usd: onChainToUsd(nextDaily),
          monthly_limit_usd: onChainToUsd(nextMonthly),
          is_increase: isIncrease,
        });
        return null;
      }

      // What the module will be enforcing by the time the backend cross-checks this
      // against the chain — a record saying the card may spend more than the module
      // allows is the wrong record. A decrease is in force immediately; a raise is in
      // force on the first block past `limitRaiseDelay`, which at the delay's configured
      // zero is the next one, so only a delay someone has actually turned on leaves the
      // old caps true for long enough to be worth reporting.
      const isRaiseStillWaiting = isIncrease && fresh.limitRaiseDelaySeconds > 0;
      await confirmWithBackend({
        transactionHash: result.transactionHash,
        dailyLimitUsd: isRaiseStillWaiting ? current.dailyLimitUsd : nextDaily,
        monthlyLimitUsd: isRaiseStillWaiting ? current.monthlyLimitUsd : nextMonthly,
        timezoneOffset: current.timezoneOffset,
      });

      return {
        transactionHash: result.transactionHash,
        dailyLimitUsd: onChainToUsd(nextDaily),
        monthlyLimitUsd: onChainToUsd(nextMonthly),
        isIncrease,
      };
    },
    onSuccess: result => {
      if (!result) return;
      invalidateAfterWrite();
      track(TRACKING_EVENTS.CARD_SPEND_LIMIT_UPDATE_COMPLETED, {
        daily_limit_usd: result.dailyLimitUsd,
        monthly_limit_usd: result.monthlyLimitUsd,
        is_increase: result.isIncrease,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to change your limit';
      setError(message);
      track(TRACKING_EVENTS.CARD_SPEND_LIMIT_UPDATE_FAILED, { error: message });
    },
  });

  /** Disarm a requested raise before it matures. */
  const cancelIncreaseMutation = useMutation({
    mutationFn: async () => {
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const fresh = await readFresh(queryClient, selectedUserId, safeAddress);
      // Either it matured while the sheet sat open, or another client cancelled it.
      // Sending the call anyway would succeed and change nothing, which is a signature
      // spent to tell the user something the re-read already told them.
      if (!fresh.pendingIncrease) throw new Error('There is no pending limit change.');

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        [
          {
            to: fresh.moduleAddress,
            data: encodeCancelPendingIncrease(fresh.moduleAddress),
          },
        ],
        'Failed to cancel the limit change',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) return null;

      return { transactionHash: result.transactionHash };
    },
    onSuccess: result => {
      if (!result) return;
      invalidateAfterWrite();
      track(TRACKING_EVENTS.CARD_SPEND_PENDING_INCREASE_CANCEL_COMPLETED, {
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to cancel the limit change';
      setError(message);
      track(TRACKING_EVENTS.CARD_SPEND_PENDING_INCREASE_CANCEL_FAILED, { error: message });
    },
  });

  /**
   * Move the card onto a different funding mode, migrating it to v2 if that is what the
   * mode needs.
   *
   * ## Why the migration hides inside this action
   *
   * Every cardholder is on v1 when this ships, and v1 has exactly one way to fund a card.
   * A cardholder does not have a module generation, they have a card — so nothing asks them
   * to "upgrade", and nothing tells them a module is being replaced. The first time they
   * choose a mode v1 cannot serve, the move happens underneath the answer they actually
   * gave, in the signature they were already going to give.
   *
   * ## Why it is one batch
   *
   * Four calls, all needing `msg.sender` to be the Safe, and every intermediate state is
   * broken:
   *
   *  1. `disableModule(v1)` — v2 refuses to act while v1 is enabled (`LegacyModuleStillEnabled`)
   *     and `registerSafe` asserts it outright, so this has to come first. Between here and
   *     step 3 the card cannot be debited at all.
   *  2. `enableModule(v2)`
   *  3. `registerSafe` on v2, carrying the caps and timezone the cardholder already chose
   *  4. `setMode` to what they asked for
   *
   * Batched into one user operation they either all land or none do, so the card is never
   * left with no module able to debit it. Split across signatures, a cardholder who
   * abandoned after step 1 would have a dead card and no obvious way to notice.
   *
   * ## Afterwards
   *
   * Nothing here is repeated. The Safe is a v2 Safe from then on, `moduleAddress` follows
   * it, and every later mode change is a bare `setMode`.
   */
  const switchModeMutation = useMutation({
    mutationFn: async (target: SpendMode) => {
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const fresh = await readFresh(queryClient, selectedUserId, safeAddress);

      // Read directly rather than off `fresh`, which reports whichever module operates the
      // Safe today — for a cardholder still on v1 that is v1, and the migration needs v2's
      // own ceilings and enablement state to build the batch.
      const v2 = await readV2State(safeAddress);
      if (!v2) throw new Error('This spend mode is not available yet.');

      if (!fresh.registered) throw new Error('Set up card spending first.');
      if (fresh.mode === target) throw new Error('That is already your spend mode.');
      if (fresh.pendingMode === target) {
        throw new Error('That change is already on its way.');
      }

      const needsRegistration = !v2.registeredOnChain;
      // `registerSafe` always starts a Safe in cash, so a fresh migration lands there
      // whatever the cardholder asked for. An already-registered Safe keeps the mode v2
      // has stored for it — which is not necessarily what `fresh` reports, since a Safe
      // with v1 re-enabled is reported as the v1 cardholder it is behaving like.
      const modeAfterBatch: SpendMode = needsRegistration ? 'cash' : v2.mode;

      const transactions: { to: Address; data: `0x${string}` }[] = [];

      // v1 has to go first and has to go entirely: while it is enabled v2 is inert by
      // design, and `registerSafe` refuses rather than letting one Safe hold two
      // independent sets of spending caps.
      if (v2.legacyEnabled) {
        const prevModule = await findModulePredecessor(safeAddress, MODULE as Address);
        if (!prevModule) throw new Error('Could not read your Safe. Please try again.');

        transactions.push({
          to: safeAddress,
          data: encodeFunctionData({
            abi: Safe_ABI,
            functionName: 'disableModule',
            args: [prevModule, MODULE as Address],
          }),
        });
      }

      if (!v2.moduleEnabled) {
        transactions.push({
          to: safeAddress,
          data: encodeFunctionData({
            abi: Safe_ABI,
            functionName: 'enableModule',
            args: [MODULE_V2],
          }),
        });
      }

      if (needsRegistration) {
        const carried = carriedLimits(fresh.limit, v2);
        transactions.push({
          to: MODULE_V2,
          data: encodeRegisterSafe(
            MODULE_V2,
            carried.dailyLimitUsd,
            carried.monthlyLimitUsd,
            BigInt(carried.timezoneOffset),
          ),
        });
      }

      if (modeAfterBatch !== target) {
        transactions.push({
          to: MODULE_V2,
          data: encodeFunctionData({
            abi: SolidCashModuleV2_ABI,
            functionName: 'setMode',
            args: [toContractMode(target)],
          }),
        });
      }

      if (transactions.length === 0) throw new Error('That is already your spend mode.');

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        transactions,
        'Failed to change your spend mode',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.CARD_SPEND_MODE_CHANGE_CANCELLED, { mode: target });
        return null;
      }

      // Only worth reporting when the caps actually moved module — an ordinary mode change
      // leaves them exactly where the backend already has them.
      if (needsRegistration) {
        const carried = carriedLimits(fresh.limit, v2);
        await confirmWithBackend({
          transactionHash: result.transactionHash,
          dailyLimitUsd: carried.dailyLimitUsd,
          monthlyLimitUsd: carried.monthlyLimitUsd,
          timezoneOffset: carried.timezoneOffset,
          moduleAddress: MODULE_V2,
        });
      }

      return {
        transactionHash: result.transactionHash,
        mode: target,
        migrated: needsRegistration,
        // `modeDelay` is zero at launch, so the switch is in force in the same block. Read
        // rather than assumed: a non-zero value would leave the cardholder in their old
        // mode for a while, and the sheet has to be able to say so.
        activatesInSeconds: v2.modeDelaySeconds,
      };
    },
    onSuccess: result => {
      if (!result) return;
      invalidateAfterWrite();
      track(TRACKING_EVENTS.CARD_SPEND_MODE_CHANGE_COMPLETED, {
        mode: result.mode,
        migrated: result.migrated,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to change your spend mode';
      setError(message);
      track(TRACKING_EVENTS.CARD_SPEND_MODE_CHANGE_FAILED, { error: message });
    },
  });

  /**
   * Withdraw module consent: `Safe.disableModule`, leaving the Safe registered but unable
   * to be debited.
   *
   * This is as far back as the chain lets us go, and it is the whole of what matters.
   * `registerSafe` has no counterpart — registration and the limits it wrote are
   * permanent — but the module re-checks `isModuleEnabled` on every debit, so a disabled
   * module declines immediately. The user lands in the `isRevoked` state, from which the
   * existing setup action re-enables with the same limits rather than asking for them
   * again.
   */
  const disableMutation = useMutation({
    mutationFn: async () => {
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const fresh = await readFresh(queryClient, selectedUserId, safeAddress);
      if (!fresh.moduleEnabled) throw new Error('Card spending is already off.');

      const prevModule = await findModulePredecessor(safeAddress, fresh.moduleAddress);
      // Not on the list at all: the chain disagrees with what we read a moment ago (another
      // client disabled it). Nothing to do, and sending the transaction would only revert.
      if (!prevModule) throw new Error('Card spending is already off.');

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        [
          {
            to: safeAddress,
            data: encodeFunctionData({
              abi: Safe_ABI,
              functionName: 'disableModule',
              args: [prevModule, fresh.moduleAddress],
            }),
          },
        ],
        'Failed to turn off card spending',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.CARD_SPEND_DISABLE_CANCELLED);
        return null;
      }

      return { transactionHash: result.transactionHash };
    },
    onSuccess: result => {
      if (!result) return;
      invalidateAfterWrite();
      track(TRACKING_EVENTS.CARD_SPEND_DISABLE_COMPLETED, {
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to turn off card spending';
      setError(message);
      track(TRACKING_EVENTS.CARD_SPEND_DISABLE_FAILED, { error: message });
    },
  });

  /**
   * Enable the module and register, with the chosen daily limit.
   *
   * Resolves `true` once registered, `false` when the user dismissed the signature
   * prompt, and rejects on a real failure. The false case has to be distinguishable: a
   * cancelled signature is not an error to show, but telling the user their card is set
   * up when it is not would be worse.
   */
  const register = useCallback(
    async (
      dailyLimitUsd: number,
      source: CardSpendRegistrationSource = 'spending_sheet',
      /** Ten times the daily cap when omitted, as the activation press wants. */
      monthlyLimitUsd?: number,
    ): Promise<boolean> => {
      setError(null);
      track(TRACKING_EVENTS.CARD_SPEND_REGISTER_PRESSED, {
        daily_limit_usd: dailyLimitUsd,
        monthly_limit_usd: monthlyLimitUsd,
        source,
      });
      const result = await mutation.mutateAsync({ dailyLimitUsd, monthlyLimitUsd });
      return result !== null;
    },
    [mutation],
  );

  /**
   * Change the caps on an existing registration.
   *
   * Resolves with the pair now in force, so the caller can name the number the user just
   * set rather than the one it derived, or `null` when the signature prompt was dismissed
   * and nothing changed at all.
   */
  const updateLimit = useCallback(
    async (
      change: CardSpendLimitChange,
    ): Promise<{ dailyLimitUsd: number; monthlyLimitUsd: number } | null> => {
      setError(null);
      track(TRACKING_EVENTS.CARD_SPEND_LIMIT_UPDATE_PRESSED, {
        daily_limit_usd: change.dailyLimitUsd,
        monthly_limit_usd: change.monthlyLimitUsd,
      });
      const result = await updateMutation.mutateAsync(change);
      return (
        result && {
          dailyLimitUsd: result.dailyLimitUsd,
          monthlyLimitUsd: result.monthlyLimitUsd,
        }
      );
    },
    [updateMutation],
  );

  /** Drop a requested raise. `false` when the signature prompt was dismissed. */
  const cancelPendingIncrease = useCallback(async (): Promise<boolean> => {
    setError(null);
    track(TRACKING_EVENTS.CARD_SPEND_PENDING_INCREASE_CANCEL_PRESSED);
    const result = await cancelIncreaseMutation.mutateAsync();
    return result !== null;
  }, [cancelIncreaseMutation]);

  /**
   * Turn card spending off again. Resolves `true` once the module is disabled, `false`
   * when the user dismissed the signature prompt, and rejects on a real failure — the
   * same three outcomes as {@link register}, for the same reason: telling someone their
   * card is off while it still spends would be the worst of the three to get wrong.
   */
  const disable = useCallback(async (): Promise<boolean> => {
    setError(null);
    track(TRACKING_EVENTS.CARD_SPEND_DISABLE_PRESSED);
    const result = await disableMutation.mutateAsync();
    return result !== null;
  }, [disableMutation]);

  /**
   * Change how the card is funded.
   *
   * Resolves `true` once the change is on-chain, `false` when the signature prompt was
   * dismissed, and rejects on a real failure — the same three outcomes as {@link register},
   * and for the same reason: a cancelled signature is not an error to show, but telling
   * someone their card now borrows when it does not would be worse.
   */
  const switchMode = useCallback(
    async (mode: SpendMode): Promise<boolean> => {
      setError(null);
      track(TRACKING_EVENTS.CARD_SPEND_MODE_CHANGE_PRESSED, { mode });
      const result = await switchModeMutation.mutateAsync(mode);
      return result !== null;
    },
    [switchModeMutation],
  );

  return {
    registration,
    /** Whether to offer the control at all. */
    isAvailable: isEnabled,
    /** Set up and usable. The control shows as done. */
    isRegistered: registration?.registered === true,
    /**
     * Registered on-chain but the module has been turned off on the Safe. The card will
     * decline, and re-registering is impossible (`AlreadyRegistered`) — only re-enabling
     * the module fixes it, so this state needs its own message rather than a retry.
     */
    isRevoked: registration?.registeredOnChain === true && registration.moduleEnabled === false,
    /** Guardian pause, global or per-Safe. Setup is pointless until it lifts. */
    isPaused: registration?.modulePaused === true || registration?.safePaused === true,
    /**
     * Whether to offer the off switch: the module is live on this Safe, so there is
     * consent to withdraw. False in the revoked state, where it is already off.
     */
    canDisable: registration?.moduleEnabled === true,
    /** The Safe's live caps, or null before the first read lands. */
    limit: registration?.limit ?? null,
    /** A raise that has been asked for and has not taken effect yet. */
    pendingIncrease: registration?.pendingIncrease ?? null,

    // ---- Spend mode -------------------------------------------------------------------

    /** How the card is funded today. Always `cash` for a cardholder still on v1. */
    mode: registration?.mode ?? 'cash',
    /**
     * Whether Credit and Smart can be offered at all.
     *
     * Needs the build to be configured for v2 AND the cardholder to have a working card to
     * migrate — there is nothing to move to credit if the card is not set up yet.
     */
    canChangeMode: registration?.v2Available === true && registration.registered,
    /** A switch that is armed but not yet in force, or null. Null at `modeDelay = 0`. */
    pendingMode: registration?.pendingMode ?? null,
    /** Unix seconds {@link pendingMode} takes effect. Zero when nothing is armed. */
    modeActivatesAt: registration?.modeActivatesAt ?? 0,
    /** The Safe's credit position, or null for a cardholder on v1. */
    position: registration?.position ?? null,
    /** WAD borrow rate per second, for quoting an APY. */
    borrowApyPerSecond: registration?.borrowApyPerSecond ?? 0n,
    /**
     * True only while the Safe is operated by v1 *and* has already registered on v2.
     *
     * The recoverable anomaly: v2 goes inert while v1 is enabled, so the card falls back to
     * cash and the credit line is unreachable until v1 is disabled — which is exactly what
     * changing mode does.
     */
    isLegacyConflict: registration?.cohort === SpendCohort.Both,

    isLoading: query.isLoading,
    isSwitchingMode: switchModeMutation.isPending,
    isRegistering: mutation.isPending,
    isUpdatingLimit: updateMutation.isPending,
    isCancellingIncrease: cancelIncreaseMutation.isPending,
    isDisabling: disableMutation.isPending,
    error,
    register,
    switchMode,
    updateLimit,
    cancelPendingIncrease,
    disable,
    refetch: query.refetch,
  };
}
