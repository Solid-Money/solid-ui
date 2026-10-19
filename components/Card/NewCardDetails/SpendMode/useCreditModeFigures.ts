import { useMemo } from 'react';

import { formatUsd } from '@/constants/cardSpendModule';
import {
  borrowApyPercent,
  borrowedProgress,
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

import type { BorrowedSummaryFigures } from '@/components/Card/NewCardDetails/SpendMode/SpendModePanels';

/** One "Collateral assets" row (Figma 29123:9528, 29123:9541). */
export interface CollateralRowFigures {
  key: string;
  /** "USD Yield", "EUR Yield", or the token's symbol for an asset with no product name. */
  label: string;
  icon: 'usd' | 'eur';
  /** "$230.00", or "€70.00" for a euro asset. */
  value: string;
  /** "≈ $81.60" under a euro value; absent for a dollar one. */
  usdEquivalent?: string;
}

/** The Credit panel of the spend-mode sheet: the borrowed block over the collateral list. */
export interface CreditModeFigures extends BorrowedSummaryFigures {
  /** What is left to borrow across every instance — the figure under the Credit segment. */
  availableToBorrow: string;
  collateral: CollateralRowFigures[];
}

/** The savings product each collateral token is, as the app names it. */
const COLLATERAL_LABEL: Record<string, { label: string; icon: CollateralRowFigures['icon'] }> = {
  soUSD: { label: 'USD Yield', icon: 'usd' },
  soEUR: { label: 'EUR Yield', icon: 'eur' },
};

/** Always two decimals, as the rows are drawn — unlike `formatUsd`, which drops ".00". */
const formatMoney = (amount: bigint, currency: 'USD' | 'EUR'): string =>
  (Number(amount) / 1_000_000).toLocaleString('en-US', {
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
    'debtUsd' | 'borrowingPowerUsd' | 'prospectivePowerUsd' | 'creditHeadroomUsd'
  > | null,
  fuseBorrowApyPerSecond: bigint,
  positions: CardCreditPositions | undefined,
): CreditModeFigures => {
  const instances = [
    {
      debtUsd: fuse?.debtUsd ?? 0n,
      creditLineUsd: (fuse?.borrowingPowerUsd ?? 0n) + (fuse?.prospectivePowerUsd ?? 0n),
      creditHeadroomUsd: fuse?.creditHeadroomUsd ?? 0n,
      borrowApyPerSecond: fuseBorrowApyPerSecond,
    },
    ...(positions?.base ? [positions.base] : []),
  ];

  const debt = instances.reduce((sum, instance) => sum + instance.debtUsd, 0n);
  const line = instances.reduce((sum, instance) => sum + instance.creditLineUsd, 0n);
  const headroom = instances.reduce((sum, instance) => sum + instance.creditHeadroomUsd, 0n);

  return {
    borrowed: formatUsd(debt),
    creditLimit: formatUsd(line),
    borrowApy: formatApy(borrowApyPercent(combinedBorrowRate(instances))),
    borrowedProgress: borrowedProgress(debt, line),
    availableToBorrow: formatUsd(headroom),
    collateral: [
      ...(positions?.fuse?.collateral ?? []),
      ...(positions?.base?.collateral ?? []),
    ].map(collateralRow),
  };
};

/**
 * {@link combineCreditFigures} for the signed-in cardholder. Reads the per-asset breakdown only
 * while `enabled` — the spend-mode sheet passes whether it is open.
 */
export const useCreditModeFigures = ({ enabled }: { enabled: boolean }): CreditModeFigures => {
  const { position, borrowApyPerSecond } = useCardSpendRegistration();
  const { data: positions } = useCardCreditPositions({ enabled });

  return useMemo(
    () => combineCreditFigures(position, borrowApyPerSecond, positions),
    [position, borrowApyPerSecond, positions],
  );
};

export default useCreditModeFigures;
