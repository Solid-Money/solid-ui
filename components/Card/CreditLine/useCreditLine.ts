import { useCallback, useMemo } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { fuse, mainnet } from 'viem/chains';
import { useReadContract } from 'wagmi';

import { useAaveBorrowPosition } from '@/hooks/useAaveBorrowPosition';
import { useBalances } from '@/hooks/useBalances';
import { ADDRESSES } from '@/lib/config';

const ACCOUNTANT_ABI = [
  {
    inputs: [],
    name: 'getRate',
    outputs: [{ internalType: 'uint256', name: 'rate', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// soUSD is supplied at a 70% LTV; the borrowable amount is capped a little
// below that (matches the previous in-form borrow behaviour).
const SO_USD_LTV = 70n;
const MAX_BORROW_FACTOR = 0.69;

/**
 * Shared data + math for the credit line flow. Centralises savings detection,
 * max borrow, collateral, and cost calculations so every screen agrees.
 */
export function useCreditLine() {
  const { tokens, isLoading: isBalancesLoading } = useBalances();
  const {
    totalBorrowed,
    totalSupplied,
    borrowAPY,
    savingsAPY,
    netAPY,
    isLoading: isPositionLoading,
  } = useAaveBorrowPosition();

  const { data: rate, isLoading: isRateLoading } = useReadContract({
    address: ADDRESSES.ethereum.accountant,
    abi: ACCOUNTANT_ABI,
    functionName: 'getRate',
    chainId: mainnet.id,
  });

  const soUsdToken = useMemo(
    () =>
      tokens.find(
        token =>
          token.contractAddress.toLowerCase() === ADDRESSES.fuse.vault.toLowerCase() &&
          token.chainId === fuse.id,
      ),
    [tokens],
  );

  const soUsdBalance = soUsdToken
    ? Number(soUsdToken.balance) / Math.pow(10, soUsdToken.contractDecimals)
    : 0;
  const exchangeRate = rate ? Number(formatUnits(rate, 6)) : 0;

  const savingsUsd = soUsdBalance * exchangeRate;
  const maxBorrow = soUsdBalance > 0 && exchangeRate > 0 ? savingsUsd * MAX_BORROW_FACTOR : 0;

  const hasSavings = soUsdBalance > 0;
  const hasPosition = totalBorrowed > 0;

  /** soUSD collateral required to borrow `amount` USDC (same LTV formula as before). */
  const collateralRequired = useCallback(
    (amount: string | number) => {
      const value = String(amount);
      if (!value || Number(value) <= 0 || !rate) return 0;
      try {
        const borrowWei = parseUnits(value, 6);
        const supplyWei = (borrowWei * 100n * 1000000n) / (SO_USD_LTV * rate);
        return Number(formatUnits(supplyWei, 6));
      } catch {
        return 0;
      }
    },
    [rate],
  );

  /** Estimated monthly interest cost for borrowing `amount` USDC. */
  const estMonthlyCost = useCallback(
    (amount: string | number) => ((Number(amount) || 0) * (borrowAPY / 100)) / 12,
    [borrowAPY],
  );

  return {
    totalBorrowed,
    totalSupplied,
    borrowAPY,
    savingsAPY,
    netAPY,
    soUsdBalance,
    savingsUsd,
    maxBorrow,
    exchangeRate,
    hasSavings,
    hasPosition,
    collateralRequired,
    estMonthlyCost,
    isLoading: isBalancesLoading || isPositionLoading || isRateLoading,
  };
}
