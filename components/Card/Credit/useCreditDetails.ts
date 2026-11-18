import { useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { fuse as fuseChain } from 'viem/chains';

import { assetName } from '@/components/Card/Credit/creditUi';
import { useCreditModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useCreditModeFigures';
import { borrowApyPercent, combinedBorrowRate, formatApy } from '@/constants/cardSpendV2';
import {
  type CreditCollateralAsset,
  type CreditInstancePosition,
  useCardCreditPositions,
} from '@/hooks/useCardCreditPositions';
import { type LoanSaleEvent, useLoanSales } from '@/hooks/useLoanSales';
import { useCardDisplayCurrency } from '@/hooks/useMainCurrency';
import {
  buildLoan,
  type LoanModel,
  type LoanStatus,
  STEADY_SYMBOLS,
  WAD,
  worstStatus,
} from '@/lib/creditRisk';

/** How often the page re-reads the chain: countdowns and pending unlocks move on their own. */
const REFRESH_MS = 30_000;

/** One row of the page's collateral list: an asset the cardholder holds on one instance. */
export interface CollateralEntry {
  key: string;
  chainId: number;
  asset: CreditCollateralAsset;
  name: string;
  /** "$550.00", or "€70.00" for a euro asset. */
  value: string;
  /** "$467.84 locked", "All locked", "Not locked". */
  locked: string;
  /** "Borrow up to 90% · keeps earning". */
  terms: string;
}

export interface CreditDetails {
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  /** Unix seconds, ticking, so countdowns stay live between reads. */
  now: number;
  /** One per instance that owes something or still has something locked, riskiest first. */
  loans: LoanModel[];
  positions: Record<number, CreditInstancePosition>;
  totalDebtUsd: bigint;
  /** The worse of the loans. */
  status: LoanStatus;
  /** Loans that owe something — the only ones a repayment can be for. */
  owingChainIds: number[];
  availableToSpend: string;
  creditLimit: string;
  borrowedProgress: number;
  borrowApy: string;
  /** "about $3.33 a month", from today's debt and rate. */
  monthlyInterest: string;
  collateral: CollateralEntry[];
  sales: Record<number, LoanSaleEvent[]>;
  format: (usd: bigint) => string;
}

/** Ticks every `intervalMs`, so a countdown or an unlock's wait stays current. */
export const useNow = (intervalMs: number): number => {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};

const percentOf = (wad: bigint): string => {
  const percent = Number((wad * 1000n) / WAD) / 10;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
};

const formatEuro = (amount: bigint) =>
  Number(formatUnits(amount, 6)).toLocaleString('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Whether an asset gets a row: Solid's yield shares always (they are what the line is built on),
 * everything else only when held, as the spend-mode sheet lists them.
 */
const listsAsset = (asset: CreditCollateralAsset): boolean =>
  asset.amount > 0n ||
  // soUSD on Base only when held: otherwise a second "$0.00" USD Yield row beside Fuse's.
  (STEADY_SYMBOLS.includes(asset.symbol) &&
    !(asset.symbol === 'soUSD' && asset.chainId !== fuseChain.id));

const collateralEntry = (
  asset: CreditCollateralAsset,
  format: (usd: bigint) => string,
): CollateralEntry => {
  const isEuro = asset.valueEur !== undefined;
  const lockedValue =
    isEuro && asset.amount > 0n
      ? formatEuro((asset.valueEur! * asset.escrowed) / asset.amount)
      : format(asset.escrowedValueUsd);
  return {
    key: `${asset.chainId}:${asset.token}`,
    chainId: asset.chainId,
    asset,
    name: assetName(asset),
    value: isEuro ? formatEuro(asset.valueEur!) : format(asset.valueUsd),
    locked:
      asset.escrowed === 0n
        ? 'Not locked'
        : asset.escrowed >= asset.amount
          ? 'All locked'
          : `${lockedValue} locked`,
    terms:
      asset.ltvWad > 0n && asset.countsTowardPower
        ? `Borrow up to ${percentOf(asset.ltvWad)}${STEADY_SYMBOLS.includes(asset.symbol) ? ' · keeps earning' : ''}`
        : 'Not used for borrowing',
  };
};

const STATUS_ORDER: Record<LoanStatus, number> = { 'at-risk': 0, caution: 1, healthy: 2 };

/**
 * Everything the Credit page shows, from the chain.
 *
 * The loans come from each instance's own read (`useCardCreditPositions`); the combined line
 * figures — available to spend, the limit — from the same source the spend-mode sheet uses, so
 * the two screens never quote different numbers.
 */
export const useCreditDetails = (): CreditDetails => {
  const positionsQuery = useCardCreditPositions({ enabled: true, refetchInterval: REFRESH_MS });
  const figures = useCreditModeFigures({ enabled: true });
  const sales = useLoanSales({ enabled: true });
  const { formatMicroUsd } = useCardDisplayCurrency();
  const now = useNow(1_000);
  // Loans are rebuilt on each read, not each second: only the countdown text needs the clock.
  const [builtAt, setBuiltAt] = useState(() => Math.floor(Date.now() / 1000));
  const {
    data: { fuse, base },
    isLoading,
    isError,
    refetch,
  } = positionsQuery;

  useEffect(() => {
    setBuiltAt(Math.floor(Date.now() / 1000));
  }, [fuse, base]);
  // A countdown that runs out between reads becomes "at any time" without waiting for the next.
  const minute = Math.floor(now / 60);

  const details = useMemo<Omit<CreditDetails, 'now'>>(() => {
    const instances = [fuse, base].filter(
      (position): position is CreditInstancePosition => position !== null,
    );
    const positions = Object.fromEntries(instances.map(position => [position.chainId, position]));
    const at = Math.max(builtAt, minute * 60);
    const loans = instances
      .filter(
        position => position.debtUsd > 0n || position.collateral.some(asset => asset.escrowed > 0n),
      )
      .map(position => buildLoan(position, at))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

    const totalDebtUsd = loans.reduce((sum, loan) => sum + loan.debtUsd, 0n);
    const rate = combinedBorrowRate(
      instances.map(position => ({
        debtUsd: position.debtUsd,
        borrowApyPerSecond: position.borrowApyPerSecond,
      })),
    );
    const monthly = (Number(totalDebtUsd) / 1_000_000) * (borrowApyPercent(rate) / 100 / 12);

    return {
      isLoading,
      isError,
      refetch: () => void refetch(),
      loans,
      positions,
      totalDebtUsd,
      status: worstStatus(loans.map(loan => loan.status)),
      owingChainIds: loans.filter(loan => loan.debtUsd > 0n).map(loan => loan.chainId),
      availableToSpend: figures.availableToBorrow,
      creditLimit: figures.creditLimit,
      borrowedProgress: figures.borrowedProgress,
      borrowApy: formatApy(borrowApyPercent(rate)),
      monthlyInterest: formatMicroUsd(BigInt(Math.round(monthly * 1_000_000))),
      collateral: instances
        .flatMap(position => position.collateral)
        .filter(listsAsset)
        .map(asset => collateralEntry(asset, formatMicroUsd)),
      sales,
      format: formatMicroUsd,
    };
    // Rebuilt per read and per minute, not per second: only countdown text needs the clock.
  }, [fuse, base, builtAt, minute, figures, sales, formatMicroUsd, isLoading, isError, refetch]);

  return { ...details, now };
};

export default useCreditDetails;
