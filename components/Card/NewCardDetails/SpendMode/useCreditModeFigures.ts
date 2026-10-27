import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { fuse as fuseChain } from 'viem/chains';

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
import { useCardDisplayCurrency } from '@/hooks/useMainCurrency';

import type { BorrowedSummaryFigures } from '@/components/Card/NewCardDetails/SpendMode/SpendModePanels';

/**
 * A collateral row's mark: the yield glyphs for Solid's own shares, the token's logo for the
 * crypto Base takes as collateral.
 */
export type CollateralIcon = 'usd' | 'eur' | 'cbbtc' | 'sol' | 'aave' | 'zec';

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
}

/** One instance's loan, as the borrow-position sheet lists it. */
export interface BorrowPositionFigures extends BorrowedSummaryFigures {
  chainId: number;
  /** The tab's name: the largest collateral, "+1" for each other one — "Bitcoin +1". */
  label: string;
  /** What is left to borrow on this instance alone. */
  availableToBorrow: string;
  /** "USD Yield", "Bitcoin and EUR Yield": what this loan is borrowed against. Empty unread. */
  backedBy: string;
  /** How close this position is to liquidation. Each instance liquidates on its own. */
  risk: BorrowRisk;
}

/** The Credit panel of the spend-mode sheet: the borrowed block over the collateral list. */
export interface CreditModeFigures extends BorrowedSummaryFigures {
  /** What is left to borrow across every instance — the figure under the Credit segment. */
  availableToBorrow: string;
  collateral: CollateralRowFigures[];
  /** Debt on any instance. */
  hasDebt: boolean;
  /** A line worth naming on any instance, drawn or not. */
  hasLine: boolean;
  /**
   * The loans the borrow-position sheet lists, one per instance carrying debt: both when the
   * cardholder owes on Fuse and on Base, only the one that does otherwise, and none when nothing
   * is borrowed — the sheet then shows the combined line instead.
   */
  positions: BorrowPositionFigures[];
}

/**
 * What each collateral token is, as the app names it: the savings product for Solid's shares,
 * the asset's own name for the crypto Base takes.
 */
const COLLATERAL_LABEL: Record<string, { label: string; icon: CollateralIcon }> = {
  soUSD: { label: 'USD Yield', icon: 'usd' },
  soEUR: { label: 'EUR Yield', icon: 'eur' },
  cbBTC: { label: 'Bitcoin', icon: 'cbbtc' },
  SOL: { label: 'Solana', icon: 'sol' },
  AAVE: { label: 'Aave', icon: 'aave' },
  cbZEC: { label: 'Zcash', icon: 'zec' },
};

/** Solid's yield shares: listed even at zero, since they are what the line is built on. */
const YIELD_SYMBOLS: readonly string[] = ['soUSD', 'soEUR'];

/**
 * Whether a collateral asset gets a row. The yield shares always do, as before; the crypto Base
 * accepts only when the Safe holds some — four rows of "$0.00" for coins nobody deposited would
 * bury the ones that matter.
 */
const listsCollateral = (asset: CreditCollateralAsset): boolean =>
  YIELD_SYMBOLS.includes(asset.symbol) || asset.amount > 0n;

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

/** A tab's name, falling back to the chain while the per-asset read is in flight. */
const tabLabel = (chainId: number, labels: string[]): string => {
  if (labels.length === 0) return chainId === fuseChain.id ? 'Fuse' : 'Base';
  return labels.length === 1 ? labels[0] : `${labels[0]} +${labels.length - 1}`;
};

/** What one instance's loan is borrowed against: the collateral it holds, by name. */
const backedBy = (collateral: readonly CreditCollateralAsset[] | undefined): string =>
  joinLabels(heldLabels(collateral));

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

const collateralRow = (asset: CreditCollateralAsset): CollateralRowFigures => {
  const named = COLLATERAL_LABEL[asset.symbol];
  const isEuro = asset.valueEur !== undefined;
  return {
    key: `${asset.chainId}:${asset.token}`,
    label: named?.label ?? (asset.symbol || 'Collateral'),
    icon: named?.icon ?? (isEuro ? 'eur' : 'usd'),
    value: isEuro ? formatMoney(asset.valueEur!, 'EUR') : formatMoney(asset.valueUsd, 'USD'),
    usdEquivalent: isEuro ? `≈ ${formatMoney(asset.valueUsd, 'USD')}` : undefined,
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
  const line = instances.reduce((sum, instance) => sum + instance.creditLineUsd, 0n);
  const headroom = instances.reduce((sum, instance) => sum + instance.creditHeadroomUsd, 0n);

  return {
    borrowed: format(debt),
    creditLimit: format(line),
    borrowApy: formatApy(borrowApyPercent(combinedBorrowRate(instances))),
    borrowedProgress: borrowedProgress(debt, line),
    availableToBorrow: format(headroom),
    collateral: [...(positions?.fuse?.collateral ?? []), ...(positions?.base?.collateral ?? [])]
      .filter(listsCollateral)
      .map(collateralRow),
    hasDebt: debt > 0n,
    hasLine: line > 0n,
    positions: instances
      .filter(instance => instance.debtUsd > 0n)
      .map(instance => ({
        chainId: instance.chainId,
        label: tabLabel(instance.chainId, heldLabels(instance.collateral)),
        availableToBorrow: format(instance.creditHeadroomUsd),
        borrowed: format(instance.debtUsd),
        creditLimit: format(instance.creditLineUsd),
        borrowApy: formatApy(borrowApyPercent(instance.borrowApyPerSecond)),
        borrowedProgress: borrowedProgress(instance.debtUsd, instance.creditLineUsd),
        backedBy: backedBy(instance.collateral),
        risk: borrowRisk(instance.healthFactorWad, instance.debtUsd),
      })),
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

  return useMemo(
    () => combineCreditFigures(position, borrowApyPerSecond, positions, formatMicroUsd),
    [position, borrowApyPerSecond, positions, formatMicroUsd],
  );
};

export default useCreditModeFigures;
