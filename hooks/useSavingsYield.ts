import { useEffect, useState } from 'react';

import { GetUserTransactionsQuery } from '@/graphql/generated/user-info';
import useUser from '@/hooks/useUser';
import { ADDRESSES } from '@/lib/config';
import { calculateYield, SECONDS_PER_YEAR } from '@/lib/financial';
import { SavingMode, SavingsSummaryResponse } from '@/lib/types';

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

export interface UseSavingsYieldParams {
  balance: number;
  apy: number;
  lastTimestamp: number;
  mode?: SavingMode;
  decimals?: number;
  userDepositTransactions?: GetUserTransactionsQuery;
  exchangeRate?: number;
  tokenAddress?: string;
  /** When true, treat interest inputs as loaded. Omit to use internal buckets. */
  inputsReady?: boolean;
  /** Backend savings summary — used for soFUSE interest (no subgraph available) */
  summary?: SavingsSummaryResponse | null;
  /** Vault identifier ('USDC' | 'FUSE') — FUSE uses backend summary, USDC uses subgraph */
  vault?: string;
}

export function useSavingsYield({
  balance,
  apy,
  lastTimestamp,
  mode = SavingMode.TOTAL_USD,
  decimals: vaultDecimals = 6,
  userDepositTransactions,
  exchangeRate = 1,
  tokenAddress = ADDRESSES.fuse.vault,
  inputsReady,
  summary,
  vault,
}: UseSavingsYieldParams): number {
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

  // Full calc only when inputs change (no animation). For TOTAL_USD use redeemable only so display matches withdraw.
  useEffect(() => {
    if (balance <= 0) {
      setLiveYield(0);
      setAnchor(null);
      return;
    }
    if (mode === SavingMode.TOTAL_USD) {
      setLiveYield(balance * exchangeRate);
      return;
    }

    // soFUSE CURRENT mode: use backend summary (no subgraph available for FUSE)
    // if (mode === SavingMode.CURRENT && vault === 'FUSE') {
    //   if (summary) {
    //     const backendInterest = parseFloat(summary.interestEarnedUSD);
    //     const calculatedAtUnix = Math.floor(new Date(summary.calculatedAt).getTime() / 1000);
    //     if (backendInterest >= 0 && calculatedAtUnix > 0) {
    //       setLiveYield(backendInterest);
    //       setAnchor({ value: backendInterest, time: calculatedAtUnix });
    //     }
    //   }
    //   // No summary yet — keep current value until backend responds
    //   return;
    // }

    // soUSD / soETH: subgraph-based calculation
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
    summary,
    vault,
    ...(inputsReady !== undefined ? [inputsReady] : [lastTsBucket, apyBucket]),
  ]);

  // Every second: update display with simple formula (no network)
  useEffect(() => {
    if (balance <= 0) return;
    const now = Math.floor(Date.now() / 1000);
    if (mode === SavingMode.TOTAL_USD) {
      const redeemableOnly = balance * exchangeRate;
      setLiveYield(redeemableOnly);
    } else if (mode === SavingMode.CURRENT && anchor) {
      setLiveYield(anchor.value + amountGained(balance, exchangeRate, apy, anchor.time, now));
    }
  }, [animation, balance, apy, lastTimestamp, exchangeRate, mode, anchor]);

  return liveYield;
}
