import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { base, fuse as fuseChain } from 'viem/chains';

import { formatUsd } from '@/constants/cardSpendModule';
import {
  borrowApyPercent,
  borrowedProgress,
  type BorrowRisk,
  borrowRisk,
  combinedBorrowRate,
  formatApy,
} from '@/constants/cardSpendV2';
import {
  type CardCreditPositions,
  type CreditCollateralAsset,
  useCardCreditPositions,
} from '@/hooks/useCardCreditPositions';
import {
  type CardBorrowPosition,
  useCardSpendRegistration,
} from '@/hooks/useCardSpendRegistration';
import { useCollateralOrder } from '@/hooks/useCollateralOrder';
import { useCardDisplayCurrency } from '@/hooks/useMainCurrency';
import {
  type CollateralAssetKey,
  collateralAssetKeyOf,
  DEFAULT_COLLATERAL_ORDER,
  sortByCollateralOrder,
} from '@/lib/utils/collateralOrder';

import type { BorrowedSummaryFigures } from '@/components/Card/NewCardDetails/SpendMode/SpendModePanels';

/**
 * A collateral row's mark: the yield glyphs for Solid's own shares, the token's logo for the
 * crypto Base takes as collateral.
 */
export type CollateralIcon =
  | 'usd'
  | 'eur'
  | 'eth'
  | 'cbbtc'
  | 'sobtc'
  | 'wbtc'
  | 'weth'
  | 'sol'
  | 'aave'
  | 'zec';

/** One "Collateral assets" row (Figma 29123:9528, 29123:9541). */
export interface CollateralRowFigures {
  key: string;
  /** "USD Yield", "Bitcoin", or the token's symbol for an asset with no product name. */
  label: string;
  icon: CollateralIcon;
  /** "$230.00", or "€70.00" for a euro asset. */
  value: string;
  /** "≈ $81.60" under a euro value; absent for a dollar one. */
  usdEquivalent?: string;
  /** "LTV 90%" under the label: the token's own LTV. Absent when the module sets none. */
  ltv?: string;
}

/** One instance's loan, as the borrow-position sheet lists it. */
export interface BorrowPositionFigures extends BorrowedSummaryFigures {
  chainId: number;
  /** "USD Yield", "Bitcoin and EUR Yield": what this loan is borrowed against. Empty unread. */
  backedBy: string;
  /** How close this position is to liquidation. Each instance liquidates on its own. */
  risk: BorrowRisk;
}

/** The Credit panel of the spend-mode sheet: the borrowed block over the collateral list. */
export interface CreditModeFigures extends BorrowedSummaryFigures {
  /** What is left to borrow across every instance — the figure under the Credit segment. */
  availableToBorrow: string;
  /** The rows that are listed, in the cardholder's collateral order. */
  collateral: CollateralRowFigures[];
  /**
   * Every collateral the card can lock on any instance, held or not, in the cardholder's
   * collateral order. With fewer than two there is nothing to order, so no "Edit order".
   */
  collateralKeys: CollateralAssetKey[];
  /** Debt on any instance. */
  hasDebt: boolean;
  /**
   * The chip beside "Borrowed": the closest any loan is to liquidation, since each instance
   * liquidates on its own. `none` with debt reads "Healthy".
   */
  risk: BorrowRisk;
  /** A line worth naming on any instance, drawn or not. */
  hasLine: boolean;
  /**
   * The loans the borrow-position sheet lists, one card each under the combined headline: both
   * when the cardholder owes on Fuse and on Base, only the one that does otherwise, and none when
   * nothing is borrowed — the sheet then shows the combined line instead.
   */
  positions: BorrowPositionFigures[];
}

/**
 * What each collateral token is, as the app names it: the savings product for Solid's shares,
 * the asset's own name for the crypto Base takes.
 */
export const COLLATERAL_LABEL: Readonly<Record<string, { label: string; icon: CollateralIcon }>> = {
  soUSD: { label: 'USD Yield', icon: 'usd' },
  soEUR: { label: 'EUR Yield', icon: 'eur' },
  soETH: { label: 'ETH Yield', icon: 'eth' },
  cbBTC: { label: 'Bitcoin', icon: 'cbbtc' },
  soBTC: { label: 'BTC Yield', icon: 'sobtc' },
  WBTC: { label: 'Wrapped Bitcoin', icon: 'wbtc' },
  WETH: { label: 'Ethereum', icon: 'weth' },
  SOL: { label: 'Solana', icon: 'sol' },
  AAVE: { label: 'Aave', icon: 'aave' },
  cbZEC: { label: 'Zcash', icon: 'zec' },
};

const isBase = (asset: Pick<CreditCollateralAsset, 'chainId'>): boolean =>
  asset.chainId === base.id;

/**
 * What the app calls a collateral token: the savings product for Solid's shares, the asset's own
 * name for the crypto. soUSD backs a line on Fuse and on Base, so the Base one says so.
 */
export const collateralName = (asset: Pick<CreditCollateralAsset, 'symbol' | 'chainId'>): string =>
  asset.symbol === 'soUSD' && isBase(asset)
    ? 'USD Yield on Base'
    : (COLLATERAL_LABEL[asset.symbol]?.label ?? (asset.symbol || 'Collateral'));

/** Its mark, as the collateral rows draw it. */
export const collateralIcon = (symbol: string): CollateralIcon =>
  COLLATERAL_LABEL[symbol]?.icon ?? (symbol === 'soEUR' ? 'eur' : 'usd');

/** Solid's yield shares: listed even at zero, since they are what the line is built on. */
const YIELD_SYMBOLS: readonly string[] = ['soUSD', 'soEUR'];

/**
 * Whether a collateral asset gets a row. soUSD on Fuse and soEUR always do, as before; everything
 * else only when the Safe holds some — four rows of "$0.00" for coins nobody deposited would bury
 * the ones that matter. That includes soUSD on Base, which would otherwise be a second "$0.00" USD
 * Yield row beside Fuse's, and soETH, which backs the line only for whoever holds it.
 */
const listsCollateral = (asset: CreditCollateralAsset): boolean =>
  (YIELD_SYMBOLS.includes(asset.symbol) && !(asset.symbol === 'soUSD' && isBase(asset))) ||
  asset.amount > 0n;

/** "USD Yield", "Bitcoin and USD Yield", "Bitcoin, Solana and USD Yield". */
const joinLabels = (labels: string[]): string =>
  labels.length <= 1
    ? (labels[0] ?? '')
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

/** The collateral one instance holds, largest first, by name. */
const heldLabels = (collateral: readonly CreditCollateralAsset[] | undefined): string[] =>
  [...(collateral ?? [])]
    .filter(asset => asset.amount > 0n)
    .sort((a, b) => (a.valueUsd === b.valueUsd ? 0 : a.valueUsd > b.valueUsd ? -1 : 1))
    .map(asset => COLLATERAL_LABEL[asset.symbol]?.label ?? asset.symbol)
    .filter(Boolean);

/** What one instance's loan is borrowed against: the collateral it holds, by name. */
const backedBy = (collateral: readonly CreditCollateralAsset[] | undefined): string =>
  joinLabels(heldLabels(collateral));

const RISK_ORDER: readonly BorrowRisk[] = ['none', 'caution', 'at-risk'];
const worstRisk = (risks: readonly BorrowRisk[]): BorrowRisk =>
  risks.reduce<BorrowRisk>(
    (worst, risk) => (RISK_ORDER.indexOf(risk) > RISK_ORDER.indexOf(worst) ? risk : worst),
    'none',
  );

/** The health factor of a position with no debt, as the module reports it. */
const MAX_UINT256 = 2n ** 256n - 1n;

/** Always two decimals, as the rows are drawn — unlike `formatUsd`, which drops ".00". */
const formatMoney = (amount: bigint, currency: 'USD' | 'EUR'): string =>
  Number(formatUnits(amount, 6)).toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const WAD = 10n ** 18n;

/**
 * "LTV 60%" from the module's WAD LTV, to a tenth of a percent when it is not whole. The figure
 * is the token's own `getTokenConfig(token).ltv`, before the buffer a credit spend borrows under.
 */
export const formatLtv = (ltvWad: bigint): string | undefined => {
  if (ltvWad <= 0n) return undefined;
  const percent = Number((ltvWad * 1000n) / WAD) / 10;
  return `LTV ${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

const collateralRow = (asset: CreditCollateralAsset): CollateralRowFigures => {
  const named = COLLATERAL_LABEL[asset.symbol];
  const isEuro = asset.valueEur !== undefined;
  return {
    key: `${asset.chainId}:${asset.token}`,
    label: collateralName(asset),
    icon: named?.icon ?? (isEuro ? 'eur' : 'usd'),
    value: isEuro ? formatMoney(asset.valueEur!, 'EUR') : formatMoney(asset.valueUsd, 'USD'),
    usdEquivalent: isEuro ? `≈ ${formatMoney(asset.valueUsd, 'USD')}` : undefined,
    ltv: formatLtv(asset.ltvWad),
  };
};

/**
 * The Credit panel's figures across both instances (Figma 29123:9483).
 *
 * Fuse's half is the registration read every other spend surface shows, so the line here is
 * that line plus Base's — never a second, independently derived Fuse figure. Base's half and the
 * per-asset rows come from `useCardCreditPositions`.
 *
 * Pure so the combination can be tested without the queries behind it.
 */
export const combineCreditFigures = (
  fuse: Pick<
    CardBorrowPosition,
    | 'debtUsd'
    | 'borrowingPowerUsd'
    | 'prospectivePowerUsd'
    | 'creditHeadroomUsd'
    | 'healthFactorWad'
  > | null,
  fuseBorrowApyPerSecond: bigint,
  positions: CardCreditPositions | undefined,
  /** Formats a 6-decimal USD figure; the main currency's formatter on screen. */
  format: (amount: bigint) => string = formatUsd,
  /** The cardholder's collateral order, which the rows are listed in. */
  collateralOrder: readonly CollateralAssetKey[] = DEFAULT_COLLATERAL_ORDER,
): CreditModeFigures => {
  const instances = [
    {
      chainId: fuseChain.id,
      debtUsd: fuse?.debtUsd ?? 0n,
      creditLineUsd: (fuse?.borrowingPowerUsd ?? 0n) + (fuse?.prospectivePowerUsd ?? 0n),
      creditHeadroomUsd: fuse?.creditHeadroomUsd ?? 0n,
      borrowApyPerSecond: fuseBorrowApyPerSecond,
      healthFactorWad: fuse?.healthFactorWad ?? MAX_UINT256,
      collateral: positions?.fuse?.collateral,
    },
    ...(positions?.base ? [positions.base] : []),
  ];

  const debt = instances.reduce((sum, instance) => sum + instance.debtUsd, 0n);
  const loans = instances
    .filter(instance => instance.debtUsd > 0n)
    .map(instance => ({
      chainId: instance.chainId,
      borrowed: format(instance.debtUsd),
      creditLimit: format(instance.creditLineUsd),
      borrowApy: formatApy(borrowApyPercent(instance.borrowApyPerSecond)),
      borrowedProgress: borrowedProgress(instance.debtUsd, instance.creditLineUsd),
      backedBy: backedBy(instance.collateral),
      risk: borrowRisk(instance.healthFactorWad, instance.debtUsd),
    }));
  const line = instances.reduce((sum, instance) => sum + instance.creditLineUsd, 0n);
  const headroom = instances.reduce((sum, instance) => sum + instance.creditHeadroomUsd, 0n);
  const accepted = [...(positions?.fuse?.collateral ?? []), ...(positions?.base?.collateral ?? [])];
  const keyOf = (asset: CreditCollateralAsset) => collateralAssetKeyOf(asset.symbol);
  const lockable = new Set(
    accepted.map(keyOf).filter((key): key is CollateralAssetKey => key !== undefined),
  );

  return {
    borrowed: format(debt),
    creditLimit: format(line),
    borrowApy: formatApy(borrowApyPercent(combinedBorrowRate(instances))),
    borrowedProgress: borrowedProgress(debt, line),
    availableToBorrow: format(headroom),
    // In the order the card locks them. soUSD on Fuse and on Base share one key, and keep Fuse
    // first between them.
    collateral: sortByCollateralOrder(accepted.filter(listsCollateral), keyOf, collateralOrder).map(
      collateralRow,
    ),
    collateralKeys: sortByCollateralOrder([...lockable], key => key, collateralOrder),
    hasDebt: debt > 0n,
    hasLine: line > 0n,
    risk: worstRisk(loans.map(loan => loan.risk)),
    positions: loans,
  };
};

/**
 * {@link combineCreditFigures} for the signed-in cardholder. Reads the per-asset breakdown only
 * while `enabled` — the spend-mode sheet passes whether it is open.
 */
export const useCreditModeFigures = ({ enabled }: { enabled: boolean }): CreditModeFigures => {
  const { position, borrowApyPerSecond } = useCardSpendRegistration();
  const { data: positions } = useCardCreditPositions({ enabled });
  const { formatMicroUsd } = useCardDisplayCurrency();
  const { order: collateralOrder } = useCollateralOrder();

  return useMemo(
    () =>
      combineCreditFigures(
        position,
        borrowApyPerSecond,
        positions,
        formatMicroUsd,
        collateralOrder,
      ),
    [position, borrowApyPerSecond, positions, formatMicroUsd, collateralOrder],
  );
};

export default useCreditModeFigures;
