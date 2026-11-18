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
  | { kind: 'multi'; togetherDrop: number }
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
      noWaitPriceUsd: priceAt(floorCover),
    };
  } else {
    const volatileCover = volatile.reduce((sum, asset) => sum + asset.coverUsd, 0n);
    risk = { kind: 'multi', togetherDrop: Math.max(0, ratio(max(buffer, 0n), volatileCover)) };
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
  };
  model.payDown = suggestPayDown(model);
  return model;
};

/** The loan on one instance, from its live read. */
export const buildLoan = (position: CreditInstancePosition, nowSeconds: number): LoanModel =>
  assemble(position, position.collateral, position.healthFactorWad, nowSeconds);

/**
 * Health after retiring `amountUsd` of debt with `asset`'s own locked balance
 * (`repayFromCollateral`): its cover drops by the amount and fee, the debt by the amount.
 */
export const healthAfterPayDown = (
  loan: Pick<LoanModel, 'coverUsd' | 'debtUsd'>,
  asset: Pick<LoanAsset, 'ltWad' | 'repayFeeBps'>,
  amountUsd: bigint,
): bigint | null => {
  const debtAfter = loan.debtUsd - amountUsd;
  if (debtAfter <= 0n) return null;
  const taken = (amountUsd * (BPS + BigInt(asset.repayFeeBps))) / BPS;
  const coverAfter = max(loan.coverUsd - (taken * asset.ltWad) / WAD, 0n);
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
  const candidates = loan.assets.filter(
    asset => asset.priceUsable && asset.priceInBand && asset.escrowedValueUsd > 0n,
  );
  if (candidates.length === 0) return null;

  const asset = [...candidates].sort((a, b) =>
    a.ltWad === b.ltWad
      ? a.escrowedValueUsd > b.escrowedValueUsd
        ? -1
        : 1
      : a.ltWad < b.ltWad
        ? -1
        : 1,
  )[0];

  const target = PAY_DOWN_TARGET_HF_WAD;
  const effectiveLt = (asset.ltWad * (BPS + BigInt(asset.repayFeeBps))) / BPS;
  const shortfall = (target * loan.debtUsd) / WAD - loan.coverUsd;
  if (shortfall <= 0n) return null;
  if (target <= effectiveLt) return null;

  const exact = (shortfall * WAD) / (target - effectiveLt);
  // What the asset can actually retire, its fee included.
  const affordable = (asset.escrowedValueUsd * BPS) / (BPS + BigInt(asset.repayFeeBps));
  const amountUsd = min(min(roundUpToStep(exact), affordable), loan.debtUsd);
  if (amountUsd <= 0n) return null;

  const hfAfterWad = healthAfterPayDown(loan, asset, amountUsd);
  return {
    asset,
    amountUsd,
    hfAfterWad,
    reachesTarget: hfAfterWad === null || hfAfterWad >= target,
  };
};

/** What can be unlocked from `asset` with nothing repaid, in token units and value. */
export const freeToUnlock = (
  loan: Pick<LoanModel, 'debtUsd' | 'powerUsd'>,
  asset: Pick<
    LoanAsset,
    'escrowed' | 'escrowedValueUsd' | 'priceUsd' | 'decimals' | 'ltvWad' | 'countsTowardPower'
  >,
): { amount: bigint; valueUsd: bigint } => {
  if (loan.debtUsd === 0n) return { amount: asset.escrowed, valueUsd: asset.escrowedValueUsd };
  // An asset the module does not lend against adds no power, so taking it costs none.
  if (!asset.countsTowardPower || asset.ltvWad === 0n) {
    return loan.powerUsd >= loan.debtUsd
      ? { amount: asset.escrowed, valueUsd: asset.escrowedValueUsd }
      : { amount: 0n, valueUsd: 0n };
  }
  const spare = max(loan.powerUsd - loan.debtUsd, 0n);
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
 * `debt − (power − value × LTV)`. Paid from another locked asset, that asset stops backing the
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
  const neededUsd = max(loan.debtUsd - (loan.powerUsd - removedPower), 0n);

  let repayUsd = 0n;
  let sourceRemovedUnits = 0n;
  let unavailableReason: string | null = null;

  if (neededUsd > 0n) {
    if (source.kind === 'wallet') {
      repayUsd = roundUpToStep(neededUsd);
    } else {
      const s = source.asset;
      const fee = BigInt(s.repayFeeBps);
      const takesPower = s.countsTowardPower ? (s.ltvWad * (BPS + fee)) / BPS : 0n;
      if (takesPower >= WAD) {
        unavailableReason = `${s.symbol} can’t cover this on its own.`;
      } else {
        repayUsd = roundUpToStep((neededUsd * WAD) / (WAD - takesPower));
        const takenUsd = (repayUsd * (BPS + fee)) / BPS;
        if (takenUsd > s.escrowedValueUsd) {
          unavailableReason = `Not enough ${s.symbol} locked in this loan.`;
        }
        sourceRemovedUnits = unitsCeil(takenUsd, s.priceUsd, s.decimals);
      }
    }
  }

  const requiresFullRepay = neededUsd > 0n && repayUsd >= loan.debtUsd;
  if (requiresFullRepay) repayUsd = loan.debtUsd;
  const debtAfterUsd = loan.debtUsd - repayUsd;

  const collateral = position.collateral.map(entry => {
    const isAsset = entry.token.toLowerCase() === asset.token.toLowerCase();
    const isSource =
      source.kind === 'collateral' &&
      entry.token.toLowerCase() === source.asset.token.toLowerCase();
    if (!isAsset && !isSource) return entry;
    const escrowed = max(
      entry.escrowed - (isAsset ? units : 0n) - (isSource ? sourceRemovedUnits : 0n),
      0n,
    );
    return {
      ...entry,
      escrowed,
      escrowedValueUsd: entry.priceUsable ? valueOf(escrowed, entry.priceUsd, entry.decimals) : 0n,
    };
  });
  const after = assemble(
    { ...position, debtUsd: debtAfterUsd, pendingUnlock: null },
    collateral,
    undefined,
    nowSeconds,
  );

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
