import type {
  CreditCollateralAsset,
  CreditInstancePosition,
  PendingCollateralUnlock,
} from '@/hooks/useCardCreditPositions';
import type { Address } from 'viem';

/**
 * What one credit loan means for the cardholder: how safe it is, what would have to happen for
 * part of it to be sold, and what each way out of it would do.
 *
 * Every figure follows `SolidCashModuleV2`'s own rules, read from the chain rather than assumed:
 *
 *  - A loan is one instance's debt (Fuse or Base). Inside it, every locked asset backs all of the
 *    debt, so there is no per-asset loan.
 *  - **Cover** is each locked asset's value × its liquidation threshold. Health is cover ÷ debt;
 *    a sale is possible below 1.0. The "sold at" line is cover ÷ value, a blend of the thresholds.
 *  - **Borrowing power** is each lendable asset's value × its LTV. Unlocking while a loan is open
 *    must leave debt ≤ power (`processCollateralWithdrawal`), so unlocking is sized on power.
 *  - Below 1.0 a sale waits `liquidationGracePeriod` from `unhealthySince`, except under
 *    `graceFloorHf` when the loan carries no forced charge. One sale covers at most
 *    `closeFactorBps` of the debt (all of it at or under `minPositionUsd`), and takes the seized
 *    asset's `liquidationBonusBps` on top.
 *
 * Pure: no reads, no clock. Callers pass the time.
 *
 * USD figures are 6-decimal bigints, as the module reports them; thresholds and health are WAD.
 */

export const WAD = 10n ** 18n;
const BPS = 10_000n;
const USD = 1_000_000n;

/**
 * Below this health a loan is "Getting close": about a 5% fall from a sale. Presentation only —
 * the module knows nothing above 1.0.
 */
export const CAUTION_HF_WAD = (105n * WAD) / 100n;

/**
 * What a pay-down suggestion aims for: comfortably back above "Getting close", near where a
 * fresh loan rests (threshold ÷ (LTV × 95%) ≈ 1.11 for the yield assets).
 */
export const PAY_DOWN_TARGET_HF_WAD = (110n * WAD) / 100n;

/** A cent, for a repayment that the $5 step would round onto the whole debt. */
const CENT_USD = USD / 100n;

/** Repayments that size an unlock are rounded up to this, so a small move cannot block it. */
export const UNLOCK_REPAY_STEP_USD = 5n * USD;

/** Health the module reports for a position with no debt. */
const NO_DEBT_HF = 2n ** 255n;

/**
 * Yield shares that hold their value: only interest moves a loan backed by these alone. Everything
 * else — Bitcoin, ETH, ETH Yield (priced in ETH), the other crypto — can fall.
 */
export const STEADY_SYMBOLS: readonly string[] = ['soUSD', 'soEUR'];

export type LoanStatus = 'healthy' | 'caution' | 'at-risk';

export interface LoanAsset {
  chainId: number;
  token: Address;
  symbol: string;
  decimals: number;
  /** Locked against this loan, token units. */
  escrowed: bigint;
  escrowedValueUsd: bigint;
  /** In the Safe and not locked, token units. */
  loose: bigint;
  looseValueUsd: bigint;
  priceUsd: bigint;
  priceUsable: boolean;
  priceInBand: boolean;
  ltvWad: bigint;
  ltWad: bigint;
  liquidationBonusBps: number;
  repayFeeBps: number;
  countsTowardPower: boolean;
  /** Holds its value (a yield share), so it never moves the loan toward a sale. */
  steady: boolean;
  /** Its part of the loan's cover: locked value × threshold. */
  coverUsd: bigint;
  /** Its part of the loan's borrowing power: locked value × LTV, when it is lendable. */
  powerUsd: bigint;
  /** {@link coverUsd} over the loan's whole cover, 0–1. */
  shareOfCover: number;
  /**
   * How far this asset alone could fall, everything else steady, before a sale: 0–1. Null when it
   * cannot cause one by itself, or holds its value.
   */
  aloneDrop: number | null;
  /** The price at which {@link aloneDrop} is reached. Null alongside it. */
  aloneSellPriceUsd: bigint | null;
}

/** What has to happen for part of the loan to be sold. */
export type LoanRisk =
  /** Every locked asset holds its value: only interest moves the loan. */
  | { kind: 'steady' }
  /** One volatile asset: an exact price. */
  | {
      kind: 'single';
      asset: LoanAsset;
      /** Null when that asset alone cannot take the loan under 1.0. */
      sellPriceUsd: bigint | null;
      /** How far it is from that price, 0–1. */
      drop: number | null;
      /** Under this price there is no wait (`graceFloorHf`). Null when unreachable. */
      noWaitPriceUsd: bigint | null;
    }
  /** Several volatile assets: how far they can all fall together. */
  /**
   * How far they can all fall together, 0–1. Null when even all of them falling to nothing would
   * leave the loan covered: the steady assets hold it up on their own.
   */
  | { kind: 'multi'; togetherDrop: number | null }
  /** Some locked asset has no usable price, so nothing can be worked out — or sold. */
  | { kind: 'unpriced' };

/** When a sale can happen, for a loan under 1.0. */
export type LoanSale =
  | { kind: 'countdown'; startedAt: number; saleAt: number }
  | { kind: 'now' }
  /** Under 1.0 but not yet recorded on-chain; the wait starts once it is. */
  | { kind: 'unrecorded' }
  /** A locked asset's price is unavailable or out of range: the module refuses any sale. */
  | { kind: 'prices-updating' }
  /** The guardian has paused liquidations. */
  | { kind: 'paused' };

export interface PayDownSuggestion {
  asset: LoanAsset;
  /** Debt to retire, rounded up to a whole $5 and never more than the debt. */
  amountUsd: bigint;
  /** Health afterwards, WAD. Null when the loan is cleared. */
  hfAfterWad: bigint | null;
  /** Below this the loan is not back to Healthy even after paying (the asset ran out). */
  reachesTarget: boolean;
}

export interface LoanModel {
  chainId: number;
  moduleAddress: Address;
  debtUsd: bigint;
  /** The module's own health, WAD. */
  healthFactorWad: bigint;
  /** For display. Null with no debt. */
  healthFactor: number | null;
  status: LoanStatus;
  /** Locked assets, largest first. */
  assets: LoanAsset[];
  valueUsd: bigint;
  coverUsd: bigint;
  powerUsd: bigint;
  /** Debt over locked value, 0–1+. */
  ltv: number;
  /** Cover over locked value: where on the same scale a sale starts. */
  soldAt: number;
  risk: LoanRisk;
  /** Null unless the loan is under 1.0. */
  sale: LoanSale | null;
  /** When the loan was first recorded under 1.0, unix seconds; 0 when it has not been. */
  unhealthySince: number;
  /** The wait between that and a sale (`liquidationGracePeriod`), in seconds. */
  saleWaitSeconds: number;
  /** The most one sale can cover. */
  maxSaleUsd: bigint;
  /** The penalty a sale adds, across this loan's locked assets, in bps. */
  penaltyBps: { min: number; max: number };
  payDown: PayDownSuggestion | null;
  /** Borrowing power the loan is not using: what can be unlocked without repaying. */
  sparePowerUsd: bigint;
  pendingUnlock: (PendingCollateralUnlock & { asset: LoanAsset | undefined }) | null;
  borrowApyPerSecond: bigint;
  /** How long an unlock waits before it can be finished (`collateralWithdrawDelay`), seconds. */
  unlockWaitSeconds: number;
}

const min = (a: bigint, b: bigint) => (a < b ? a : b);
const max = (a: bigint, b: bigint) => (a > b ? a : b);
const ratio = (numerator: bigint, denominator: bigint): number =>
  denominator > 0n ? Number((numerator * 1_000_000n) / denominator) / 1_000_000 : 0;

export const valueOf = (amount: bigint, priceUsd: bigint, decimals: number): bigint =>
  (amount * priceUsd) / 10n ** BigInt(decimals);

/** USD to token units, rounded down: what can be taken without overshooting. */
export const unitsFloor = (usd: bigint, priceUsd: bigint, decimals: number): bigint =>
  priceUsd > 0n ? (usd * 10n ** BigInt(decimals)) / priceUsd : 0n;

/** USD to token units, rounded up: what covers a figure in full. */
export const unitsCeil = (usd: bigint, priceUsd: bigint, decimals: number): bigint =>
  priceUsd > 0n ? (usd * 10n ** BigInt(decimals) + priceUsd - 1n) / priceUsd : 0n;

/** Up to the next whole step strictly above `usd`, so the figure always clears what it covers. */
export const roundUpToStep = (usd: bigint, step = UNLOCK_REPAY_STEP_USD): bigint =>
  usd <= 0n ? 0n : (usd / step + 1n) * step;

export const statusOf = (healthFactorWad: bigint, debtUsd: bigint): LoanStatus => {
  if (debtUsd === 0n || healthFactorWad >= NO_DEBT_HF) return 'healthy';
  if (healthFactorWad < WAD) return 'at-risk';
  if (healthFactorWad < CAUTION_HF_WAD) return 'caution';
  return 'healthy';
};

const STATUS_RANK: Record<LoanStatus, number> = { healthy: 0, caution: 1, 'at-risk': 2 };

/** The worse of several loans' statuses. */
export const worstStatus = (statuses: readonly LoanStatus[]): LoanStatus =>
  statuses.reduce<LoanStatus>(
    (worst, status) => (STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst),
    'healthy',
  );

const toLoanAsset = (
  asset: CreditCollateralAsset,
): Omit<LoanAsset, 'shareOfCover' | 'aloneDrop' | 'aloneSellPriceUsd'> => {
  const escrowedValueUsd = asset.priceUsable ? asset.escrowedValueUsd : 0n;
  return {
    chainId: asset.chainId,
    token: asset.token,
    symbol: asset.symbol,
    decimals: asset.decimals,
    escrowed: asset.escrowed,
    escrowedValueUsd,
    loose: asset.loose,
    looseValueUsd: asset.priceUsable ? valueOf(asset.loose, asset.priceUsd, asset.decimals) : 0n,
    priceUsd: asset.priceUsd,
    priceUsable: asset.priceUsable,
    priceInBand: asset.priceInBand,
    ltvWad: asset.ltvWad,
    ltWad: asset.ltWad,
    liquidationBonusBps: asset.liquidationBonusBps,
    repayFeeBps: asset.repayFeeBps,
    countsTowardPower: asset.countsTowardPower,
    steady: STEADY_SYMBOLS.includes(asset.symbol),
    coverUsd: (escrowedValueUsd * asset.ltWad) / WAD,
    powerUsd: asset.countsTowardPower ? (escrowedValueUsd * asset.ltvWad) / WAD : 0n,
  };
};

/**
 * The loan's figures from its locked assets and debt. Health is taken from `healthFactorWad`
 * when given — the module's own answer for the live loan — and worked out from cover otherwise,
 * which is how a "what if" is priced.
 */
const assemble = (
  position: Pick<
    CreditInstancePosition,
    | 'chainId'
    | 'moduleAddress'
    | 'debtUsd'
    | 'unhealthySince'
    | 'forcedDebtUsd'
    | 'liquidationsPaused'
    | 'params'
    | 'borrowApyPerSecond'
    | 'pendingUnlock'
  >,
  collateral: readonly CreditCollateralAsset[],
  healthFactorWad: bigint | undefined,
  nowSeconds: number,
): LoanModel => {
  const debtUsd = position.debtUsd;
  const base = collateral
    .filter(asset => asset.escrowed > 0n)
    .map(toLoanAsset)
    .sort((a, b) =>
      a.escrowedValueUsd === b.escrowedValueUsd
        ? 0
        : a.escrowedValueUsd > b.escrowedValueUsd
          ? -1
          : 1,
    );

  const valueUsd = base.reduce((sum, asset) => sum + asset.escrowedValueUsd, 0n);
  const coverUsd = base.reduce((sum, asset) => sum + asset.coverUsd, 0n);
  const powerUsd = base.reduce((sum, asset) => sum + asset.powerUsd, 0n);
  const buffer = coverUsd - debtUsd;
  const fullyPriced = base.every(asset => asset.priceUsable);

  const assets: LoanAsset[] = base.map(asset => {
    // Alone: everything else steady, how far this one could fall before cover meets the debt.
    const canCauseSale = !asset.steady && asset.coverUsd > 0n && asset.coverUsd > buffer;
    const aloneDrop = canCauseSale ? Math.max(0, ratio(max(buffer, 0n), asset.coverUsd)) : null;
    const aloneSellPriceUsd =
      canCauseSale && asset.priceUsable
        ? (asset.priceUsd * max(asset.coverUsd - max(buffer, 0n), 0n)) / asset.coverUsd
        : null;
    return {
      ...asset,
      shareOfCover: ratio(asset.coverUsd, coverUsd),
      aloneDrop,
      aloneSellPriceUsd,
    };
  });

  const hfWad =
    healthFactorWad ?? (debtUsd === 0n ? NO_DEBT_HF : (coverUsd * WAD) / max(debtUsd, 1n));
  const status = statusOf(hfWad, debtUsd);

  // --- what would have to happen ---
  const volatile = assets.filter(asset => !asset.steady);
  let risk: LoanRisk;
  if (!fullyPriced) {
    risk = { kind: 'unpriced' };
  } else if (volatile.length === 0) {
    risk = { kind: 'steady' };
  } else if (volatile.length === 1) {
    const asset = volatile[0];
    const othersCover = coverUsd - asset.coverUsd;
    const priceAt = (targetCover: bigint): bigint | null => {
      const needed = targetCover - othersCover;
      if (needed <= 0n || asset.coverUsd === 0n) return null;
      return (asset.priceUsd * needed) / asset.coverUsd;
    };
    const sellPriceUsd = priceAt(debtUsd);
    const floorCover = (debtUsd * position.params.graceFloorHfWad) / WAD;
    risk = {
      kind: 'single',
      asset,
      sellPriceUsd,
      drop:
        sellPriceUsd !== null && asset.priceUsd > 0n
          ? Math.max(0, 1 - ratio(sellPriceUsd, asset.priceUsd))
          : null,
      // A loan carrying a forced charge always gets the full wait, so it has no such price.
      noWaitPriceUsd: position.forcedDebtUsd > 0n ? null : priceAt(floorCover),
    };
  } else {
    const volatileCover = volatile.reduce((sum, asset) => sum + asset.coverUsd, 0n);
    risk = {
      kind: 'multi',
      togetherDrop:
        volatileCover > max(buffer, 0n) ? Math.max(0, ratio(max(buffer, 0n), volatileCover)) : null,
    };
  }

  // --- when a sale could happen ---
  let sale: LoanSale | null = null;
  if (debtUsd > 0n && hfWad < WAD) {
    if (position.liquidationsPaused) sale = { kind: 'paused' };
    else if (!fullyPriced || assets.some(asset => !asset.priceInBand)) {
      sale = { kind: 'prices-updating' };
    } else if (position.unhealthySince === 0) sale = { kind: 'unrecorded' };
    else {
      const saleAt = position.unhealthySince + position.params.liquidationGracePeriod;
      const noWait = position.forcedDebtUsd === 0n && hfWad < position.params.graceFloorHfWad;
      sale =
        noWait || nowSeconds >= saleAt
          ? { kind: 'now' }
          : { kind: 'countdown', startedAt: position.unhealthySince, saleAt };
    }
  }

  const maxSaleUsd =
    debtUsd <= position.params.minPositionUsd
      ? debtUsd
      : (debtUsd * BigInt(position.params.closeFactorBps)) / BPS;
  const bonuses = assets.map(asset => asset.liquidationBonusBps);

  const model: LoanModel = {
    chainId: position.chainId,
    moduleAddress: position.moduleAddress,
    debtUsd,
    healthFactorWad: hfWad,
    healthFactor: debtUsd === 0n || hfWad >= NO_DEBT_HF ? null : Number(hfWad) / 1e18,
    status,
    assets,
    valueUsd,
    coverUsd,
    powerUsd,
    ltv: ratio(debtUsd, valueUsd),
    soldAt: ratio(coverUsd, valueUsd),
    risk,
    sale,
    unhealthySince: position.unhealthySince,
    saleWaitSeconds: position.params.liquidationGracePeriod,
    maxSaleUsd,
    penaltyBps: {
      min: bonuses.length ? Math.min(...bonuses) : 0,
      max: bonuses.length ? Math.max(...bonuses) : 0,
    },
    payDown: null,
    sparePowerUsd: max(powerUsd - debtUsd, 0n),
    pendingUnlock: position.pendingUnlock
      ? {
          ...position.pendingUnlock,
          asset: assets.find(
            asset => asset.token.toLowerCase() === position.pendingUnlock!.token.toLowerCase(),
          ),
        }
      : null,
    borrowApyPerSecond: position.borrowApyPerSecond,
    unlockWaitSeconds: position.params.collateralWithdrawDelay,
  };
  model.payDown = suggestPayDown(model);
  return model;
};

/** The loan on one instance, from its live read. */
export const buildLoan = (position: CreditInstancePosition, nowSeconds: number): LoanModel =>
  assemble(position, position.collateral, position.healthFactorWad, nowSeconds);

/**
 * What `repayFromCollateral` takes from `asset` and credits for `amountUsd`, sized as the module's
 * `sizeCollateralRepay` sizes it: the principal rounded up in token units, the fee on those units
 * rounded up on its own, and — when that is more than is locked — everything locked, crediting
 * what it is worth after the fee.
 */
export const sizeCollateralRepay = (
  asset: Pick<LoanAsset, 'priceUsd' | 'decimals' | 'escrowed' | 'repayFeeBps'>,
  amountUsd: bigint,
): { units: bigint; creditedUsd: bigint; capped: boolean } => {
  if (asset.priceUsd === 0n || amountUsd <= 0n)
    return { units: 0n, creditedUsd: 0n, capped: false };
  const unit = 10n ** BigInt(asset.decimals);
  const fee = BigInt(asset.repayFeeBps);
  const principal = (amountUsd * unit + asset.priceUsd - 1n) / asset.priceUsd;
  const units = principal + (principal * fee + BPS - 1n) / BPS;
  if (units <= asset.escrowed) return { units, creditedUsd: amountUsd, capped: false };
  const credited = (asset.escrowed * asset.priceUsd * BPS) / (unit * (BPS + fee));
  return { units: asset.escrowed, creditedUsd: min(credited, amountUsd), capped: true };
};

/**
 * Health after retiring `amountUsd` of debt with `asset`'s own locked balance
 * (`repayFromCollateral`): the asset's cover is what stays locked after the actual debit, and the
 * debt falls by what that debit credits.
 */
export const healthAfterPayDown = (
  loan: Pick<LoanModel, 'coverUsd' | 'debtUsd'>,
  asset: Pick<
    LoanAsset,
    'ltWad' | 'repayFeeBps' | 'priceUsd' | 'decimals' | 'escrowed' | 'coverUsd'
  >,
  amountUsd: bigint,
): bigint | null => {
  const { units, creditedUsd } = sizeCollateralRepay(asset, amountUsd);
  const debtAfter = loan.debtUsd - creditedUsd;
  if (debtAfter <= 0n) return null;
  const remainingCover =
    (valueOf(asset.escrowed - units, asset.priceUsd, asset.decimals) * asset.ltWad) / WAD;
  const coverAfter = max(loan.coverUsd - asset.coverUsd + remainingCover, 0n);
  return (coverAfter * WAD) / debtAfter;
};

/**
 * The asset to pay the loan down with, and how much.
 *
 * The asset with the lowest threshold: repaying a dollar with it removes the least cover, so
 * health rises the most per dollar — and it is usually the most volatile, so the loan sheds the
 * most risk too. Sized to reach {@link PAY_DOWN_TARGET_HF_WAD}:
 * `(C − x·T·(1+f)) / (D − x) = H` → `x = (H·D − C) / (H − T·(1+f))`.
 */
export const suggestPayDown = (
  loan: Pick<LoanModel, 'assets' | 'debtUsd' | 'coverUsd'>,
): PayDownSuggestion | null => {
  if (loan.debtUsd === 0n) return null;
  const target = PAY_DOWN_TARGET_HF_WAD;
  const shortfall = (target * loan.debtUsd) / WAD - loan.coverUsd;
  if (shortfall <= 0n) return null;
  const healthNow = (loan.coverUsd * WAD) / loan.debtUsd;

  // Sized per asset, then compared on what each can actually reach: a tiny balance at the lowest
  // threshold is no use if a larger one gets the loan back to Healthy.
  const options = loan.assets
    .filter(asset => asset.priceUsable && asset.priceInBand && asset.escrowedValueUsd > 0n)
    .flatMap((asset): PayDownSuggestion[] => {
      const effectiveLt = (asset.ltWad * (BPS + BigInt(asset.repayFeeBps))) / BPS;
      if (target <= effectiveLt) return [];
      const exact = (shortfall * WAD) / (target - effectiveLt);
      // What the asset can actually retire, its fee included.
      const affordable = (asset.escrowedValueUsd * BPS) / (BPS + BigInt(asset.repayFeeBps));
      const amountUsd = min(min(roundUpToStep(exact), affordable), loan.debtUsd);
      if (amountUsd <= 0n) return [];
      const hfAfterWad = healthAfterPayDown(loan, asset, amountUsd);
      // Repaying with an asset whose threshold (with its fee) is above the loan's health lowers
      // health: the module allows that under 1.0, but it is no way out. Only a clear or a rise.
      if (hfAfterWad !== null && hfAfterWad <= healthNow) return [];
      return [
        {
          asset,
          amountUsd,
          hfAfterWad,
          reachesTarget: hfAfterWad === null || hfAfterWad >= target,
        },
      ];
    });
  if (options.length === 0) return null;

  const reaching = options.filter(option => option.reachesTarget);
  if (reaching.length) {
    // Among those that get there, the lowest threshold: the most lift and the most risk shed.
    return reaching.sort((a, b) =>
      a.asset.ltWad === b.asset.ltWad
        ? a.asset.escrowedValueUsd > b.asset.escrowedValueUsd
          ? -1
          : 1
        : a.asset.ltWad < b.asset.ltWad
          ? -1
          : 1,
    )[0];
  }
  // None gets there: the one that gets closest.
  const healthOf = (option: PayDownSuggestion) => option.hfAfterWad ?? NO_DEBT_HF;
  return options.sort((a, b) => (healthOf(a) > healthOf(b) ? -1 : 1))[0];
};

/**
 * Interest an unlock is sized to absorb beyond its own wait: the module accrues before its release
 * check, so an unlock sized to the cent would be refused once any interest had run. A day covers a
 * cardholder who finishes later than the earliest moment, at a cost of cents.
 */
export const UNLOCK_INTEREST_HEADROOM_SECONDS = 86_400;

/**
 * The debt as it will stand when an unlock is finished: today's, plus interest through the wait and
 * {@link UNLOCK_INTEREST_HEADROOM_SECONDS}, rounded up as the module rounds debt.
 */
export const debtAtUnlock = (
  loan: Pick<LoanModel, 'debtUsd' | 'borrowApyPerSecond' | 'unlockWaitSeconds'>,
): bigint => {
  if (loan.debtUsd === 0n || loan.borrowApyPerSecond === 0n) return loan.debtUsd;
  const seconds = BigInt(loan.unlockWaitSeconds + UNLOCK_INTEREST_HEADROOM_SECONDS);
  const interest = (loan.debtUsd * loan.borrowApyPerSecond * seconds + WAD - 1n) / WAD;
  return loan.debtUsd + interest;
};

/** What can be unlocked from `asset` with nothing repaid, in token units and value. */
export const freeToUnlock = (
  loan: Pick<LoanModel, 'debtUsd' | 'powerUsd' | 'borrowApyPerSecond' | 'unlockWaitSeconds'>,
  asset: Pick<
    LoanAsset,
    'escrowed' | 'escrowedValueUsd' | 'priceUsd' | 'decimals' | 'ltvWad' | 'countsTowardPower'
  >,
): { amount: bigint; valueUsd: bigint } => {
  if (loan.debtUsd === 0n) return { amount: asset.escrowed, valueUsd: asset.escrowedValueUsd };
  // An asset the module does not lend against adds no power, so taking it costs none.
  if (!asset.countsTowardPower || asset.ltvWad === 0n) {
    return loan.powerUsd >= debtAtUnlock(loan)
      ? { amount: asset.escrowed, valueUsd: asset.escrowedValueUsd }
      : { amount: 0n, valueUsd: 0n };
  }
  const spare = max(loan.powerUsd - debtAtUnlock(loan), 0n);
  const valueUsd = min((spare * WAD) / asset.ltvWad, asset.escrowedValueUsd);
  const amount = min(unitsFloor(valueUsd, asset.priceUsd, asset.decimals), asset.escrowed);
  return { amount, valueUsd: valueOf(amount, asset.priceUsd, asset.decimals) };
};

/** How an unlock's repayment is paid. */
export type UnlockRepaySource =
  /** A tender token in the wallet, through `repayFromSafe`. */
  | { kind: 'wallet' }
  /** Another asset locked in the same loan, through `repayFromCollateral`. */
  | { kind: 'collateral'; asset: LoanAsset };

export interface UnlockQuote {
  asset: LoanAsset;
  /** Token units to unlock. */
  amount: bigint;
  valueUsd: bigint;
  /** Unlockable with nothing repaid. */
  free: { amount: bigint; valueUsd: bigint };
  /** The debt that has to go first, exactly. Zero when the unlock is free. */
  neededUsd: bigint;
  /** What will be repaid: {@link neededUsd} rounded up to a whole $5, from `source`. */
  repayUsd: bigint;
  /**
   * Getting this back means repaying the whole loan. That is a full repayment, which returns
   * every locked asset at once with no wait — not an unlock.
   */
  requiresFullRepay: boolean;
  debtAfterUsd: bigint;
  /** The loan as it would stand once the unlock is finished. */
  after: LoanModel;
  /** Why it cannot go ahead from this source, or null. */
  unavailableReason: string | null;
}

/**
 * Unlocking `amount` of `asset` while the loan stays open.
 *
 * The release is allowed only if, after it, debt ≤ borrowing power. So the repayment needed is
 * `debt − (power − value × LTV)`, with the debt taken as it will stand at the finish
 * ({@link debtAtUnlock}). Paid from another locked asset, that asset stops backing the
 * loan too, which takes `needed ÷ (1 − (1 + fee) × its LTV)`.
 */
export const quoteUnlock = ({
  position,
  loan,
  asset,
  amount,
  source,
  nowSeconds,
}: {
  position: CreditInstancePosition;
  loan: LoanModel;
  asset: LoanAsset;
  amount: bigint;
  source: UnlockRepaySource;
  nowSeconds: number;
}): UnlockQuote => {
  const units = min(max(amount, 0n), asset.escrowed);
  const valueUsd = valueOf(units, asset.priceUsd, asset.decimals);
  const free = freeToUnlock(loan, asset);
  const removedPower = asset.countsTowardPower ? (valueUsd * asset.ltvWad) / WAD : 0n;
  const neededUsd = max(debtAtUnlock(loan) - (loan.powerUsd - removedPower), 0n);

  let unavailableReason: string | null = null;
  // The repayment the unlock needs from this source, before any rounding.
  let exactRepayUsd = 0n;
  if (neededUsd > 0n) {
    if (source.kind === 'wallet') {
      exactRepayUsd = neededUsd;
    } else {
      const s = source.asset;
      const takesPower = s.countsTowardPower
        ? (s.ltvWad * (BPS + BigInt(s.repayFeeBps))) / BPS
        : 0n;
      if (takesPower >= WAD) unavailableReason = `${s.symbol} can’t cover this on its own.`;
      else exactRepayUsd = (neededUsd * WAD + WAD - takesPower - 1n) / (WAD - takesPower);
    }
  }

  /** The loan once `repayUsd` is repaid and the unlock is finished, and whether that holds. */
  const project = (repayUsd: bigint) => {
    let sourceRemovedUnits = 0n;
    let reason: string | null = null;
    if (repayUsd > 0n && source.kind === 'collateral') {
      const sized = sizeCollateralRepay(source.asset, repayUsd);
      sourceRemovedUnits = sized.units;
      // Short of the full principal and fee, the module would credit less than asked.
      if (sized.capped) reason = `Not enough ${source.asset.symbol} locked in this loan.`;
    }
    const debtAfterUsd = loan.debtUsd - repayUsd;
    const collateral = position.collateral.map(entry => {
      const isAsset = entry.token.toLowerCase() === asset.token.toLowerCase();
      const isSource =
        source.kind === 'collateral' &&
        entry.token.toLowerCase() === source.asset.token.toLowerCase();
      if (!isAsset && !isSource) return entry;
      const left = entry.escrowed - (isAsset ? units : 0n) - (isSource ? sourceRemovedUnits : 0n);
      // The same asset repaying and being released: both have to fit in what is locked.
      if (left < 0n) {
        reason ??= `Not enough ${asset.symbol} locked to repay with it and unlock this much.`;
      }
      const escrowed = max(left, 0n);
      return {
        ...entry,
        escrowed,
        escrowedValueUsd: entry.priceUsable
          ? valueOf(escrowed, entry.priceUsd, entry.decimals)
          : 0n,
      };
    });
    const after = assemble(
      { ...position, debtUsd: debtAfterUsd, pendingUnlock: null },
      collateral,
      undefined,
      nowSeconds,
    );
    // The release check the module runs: whole-unit rounding of a collateral repayment can take a
    // hair more power than it frees, so the projected loan is checked rather than assumed.
    const shortOfCover = debtAfterUsd > 0n && debtAtUnlock(after) > after.powerUsd;
    return { repayUsd, debtAfterUsd, after, reason, shortOfCover };
  };

  let requiresFullRepay = false;
  let plan: ReturnType<typeof project>;
  const fits = (candidate: ReturnType<typeof project>) =>
    !candidate.reason && !candidate.shortOfCover;
  if (unavailableReason || neededUsd === 0n) {
    plan = project(0n);
  } else {
    // The $5 step when it fits; otherwise — it fails, or reaches the whole debt — a repayment to
    // the cent, which can still leave the loan open or fit in a smaller locked balance.
    const stepped = roundUpToStep(exactRepayUsd);
    const steppedPlan = stepped < loan.debtUsd ? project(stepped) : null;
    const precise = roundUpToStep(exactRepayUsd, CENT_USD);
    const precisePlan =
      steppedPlan && fits(steppedPlan)
        ? null
        : precise < loan.debtUsd && precise !== stepped
          ? project(precise)
          : null;
    if (steppedPlan && fits(steppedPlan)) plan = steppedPlan;
    else if (precisePlan && fits(precisePlan)) plan = precisePlan;
    else if (steppedPlan) plan = steppedPlan;
    else {
      requiresFullRepay = true;
      plan = project(loan.debtUsd);
    }
  }
  unavailableReason ??=
    plan.reason ??
    (plan.shortOfCover ? 'This would leave the loan short of cover. Try a smaller amount.' : null);
  const { repayUsd, debtAfterUsd, after } = plan;

  return {
    asset,
    amount: units,
    valueUsd,
    free,
    neededUsd,
    repayUsd,
    requiresFullRepay,
    debtAfterUsd,
    after,
    unavailableReason,
  };
};

/** "17h 40m", "40m", "less than a minute". */
export const formatWait = (seconds: number): string => {
  if (seconds <= 0) return 'now';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return 'less than a minute';
};

/** "4:12": a short wait as minutes and seconds. */
export const formatClock = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

/** "5%", "7.5%": a bps figure as the percentage people read. */
export const formatBps = (bps: number): string => {
  const percent = bps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

/** "20%": a 0–1 fraction, whole percent, never "0%" for something real but small. */
export const formatFraction = (fraction: number): string => {
  const percent = fraction * 100;
  if (percent > 0 && percent < 1) return '<1%';
  return `${Math.round(percent)}%`;
};
