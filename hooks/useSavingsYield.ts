import { useEffect, useState } from 'react';

import { GetUserTransactionsQuery } from '@/graphql/generated/user-info';
import useUser from '@/hooks/useUser';
import { ADDRESSES } from '@/lib/config';
import { calculateYield, SECONDS_PER_YEAR } from '@/lib/financial';
import { SavingMode, SavingsSummaryResponse } from '@/lib/types';
import { useBalanceStore } from '@/store/useBalanceStore';

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
  /** Backend savings summary -- when provided, anchors interest from server-computed value */
  summary?: SavingsSummaryResponse | null;
  /** Vault identifier ('USDC' | 'FUSE') — controls fallback strategy */
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
  const earnedUSD = useBalanceStore(s => s.earnedUSD);

  // Seed from MMKV on first render to avoid $0 flash
  const [liveYield, setLiveYield] = useState(() => {
    if (earnedUSD > 0) {
      return earnedUSD;
    }
    return 0;
  });
  const [tick, setTick] = useState(0);
  const [anchor, setAnchor] = useState<{ value: number; time: number } | null>(null);
  const { user } = useUser();

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const lastTsBucket = lastTimestamp > 0 ? Math.floor(lastTimestamp / 86400) : 0;
  const apyBucket = Math.floor((apy ?? 0) * 100);

  // Full calc only when inputs change (no tick). For TOTAL_USD use redeemable only so display matches withdraw.
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

    // CURRENT mode (interest earned)
    if (mode === SavingMode.CURRENT) {
      // Backend-anchored interest: use server-computed interestEarnedUSD when available
      if (summary) {
        const backendInterest = parseFloat(summary.interestEarnedUSD);
        const calculatedAtUnix = Math.floor(new Date(summary.calculatedAt).getTime() / 1000);
        if (backendInterest >= 0 && calculatedAtUnix > 0) {
          setLiveYield(backendInterest);
          setAnchor({ value: backendInterest, time: calculatedAtUnix });
          return;
        }
      }

      // Summary not yet loaded — use subgraph fallback for USDC only.
      // FUSE has no client-side subgraph, so keep MMKV seed value until backend responds.
      if (!summary && (!vault || vault === 'USDC')) {
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
          // Spurious zero detection: if balance > 0 and there's a deposit timestamp,
          // a zero result is likely a data-loading artifact — suppress it.
          const isSpuriousZero = calculatedYield === 0 && balance > 0 && lastTimestamp > 0;
          if (!isSpuriousZero) {
            setLiveYield(calculatedYield);
            setAnchor({ value: calculatedYield, time: now });
          }
        });
        return () => {
          cancelled = true;
        };
      }
      // For FUSE without summary: do nothing — keep MMKV seed or current value
      return;
    }

    // Non-CURRENT modes: existing Subgraph-based calculation
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
      setLiveYield(calculatedYield);
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
      const gained = amountGained(balance, exchangeRate, apy, anchor.time, now);
      setLiveYield(Math.max(0, anchor.value + gained));
    }
  }, [tick, balance, apy, lastTimestamp, exchangeRate, mode, anchor]);

  return liveYield;
}
