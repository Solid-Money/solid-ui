/**
 * Old Total value calculation: balance × rate + accrued interest (totalUsdLive).
 * Used by /savings-old for side-by-side comparison with new redeemable-only calculation.
 * See commit e4cba95 (before "Align savings and withdraw calculation").
 */
import { useEffect, useState } from 'react';

import { GetUserTransactionsQuery } from '@/graphql/generated/user-info';
import useUser from '@/hooks/useUser';
import { ADDRESSES } from '@/lib/config';
import { calculateYield, SECONDS_PER_YEAR } from '@/lib/financial';
import { SavingMode } from '@/lib/types';

function amountGained(
  balance: number,
  exchangeRate: number,
  apy: number,
  fromTs: number,
  toTs: number,
): number {
  const balanceUSD = balance * exchangeRate;
  return (((apy / 100) * (toTs - fromTs)) / SECONDS_PER_YEAR) * balanceUSD;
}

function totalUsdLive(
  balance: number,
  exchangeRate: number,
  apy: number,
  lastTs: number,
  now: number,
): number {
  const balanceUSD = balance * exchangeRate;
  return balanceUSD + amountGained(balance, exchangeRate, apy, lastTs, now);
}

export interface UseSavingsYieldOldParams {
  balance: number;
  apy: number;
  lastTimestamp: number;
  mode?: SavingMode;
  decimals?: number;
  userDepositTransactions?: GetUserTransactionsQuery;
  exchangeRate?: number;
  tokenAddress?: string;
  inputsReady?: boolean;
}

export function useSavingsYieldOld({
  balance,
  apy,
  lastTimestamp,
  mode = SavingMode.TOTAL_USD,
  decimals: vaultDecimals = 6,
  userDepositTransactions,
  exchangeRate = 1,
  tokenAddress = ADDRESSES.fuse.vault,
  inputsReady,
}: UseSavingsYieldOldParams): number {
  const [liveYield, setLiveYield] = useState(0);
  const [animation, setAnimation] = useState(0);
  const [anchor, setAnchor] = useState<{ value: number; time: number } | null>(null);
  const { user } = useUser();

  useEffect(() => {
    const id = setInterval(() => setAnimation(a => a + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const lastTsBucket = lastTimestamp > 0 ? Math.floor(lastTimestamp / 86400) : 0;
  const apyBucket = Math.floor((apy ?? 0) * 100);

  useEffect(() => {
    if (balance <= 0) {
      setLiveYield(0);
      setAnchor(null);
      return;
    }
    let cancelled = false;
    const now = Math.floor(Date.now() / 1000);
    calculateYield(
      balance,
      apy,
      lastTimestamp,
      now,
      mode,
      userDepositTransactions,
      user?.safeAddress,
      exchangeRate,
      tokenAddress,
      vaultDecimals,
    ).then(calculatedYield => {
      if (cancelled) return;
      const isSpuriousZero =
        mode === SavingMode.CURRENT && calculatedYield === 0 && balance > 0 && lastTimestamp > 0;
      if (!isSpuriousZero) {
        setLiveYield(calculatedYield);
        if (mode === SavingMode.CURRENT) setAnchor({ value: calculatedYield, time: now });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    balance,
    apy,
    lastTimestamp,
    mode,
    userDepositTransactions,
    user?.safeAddress,
    exchangeRate,
    tokenAddress,
    vaultDecimals,
    ...(inputsReady !== undefined ? [inputsReady] : [lastTsBucket, apyBucket]),
  ]);

  useEffect(() => {
    if (balance <= 0) return;
    const now = Math.floor(Date.now() / 1000);
    if (mode === SavingMode.TOTAL_USD) {
      setLiveYield(totalUsdLive(balance, exchangeRate, apy, lastTimestamp, now));
    } else if (mode === SavingMode.CURRENT && anchor) {
      setLiveYield(anchor.value + amountGained(balance, exchangeRate, apy, anchor.time, now));
    }
  }, [animation, balance, apy, lastTimestamp, exchangeRate, mode, anchor]);

  return liveYield;
}
