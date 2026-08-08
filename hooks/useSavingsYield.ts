import { useEffect, useState } from 'react';

import { GetUserTransactionsQuery } from '@/graphql/generated/user-info';
import useUser from '@/hooks/useUser';
import { ADDRESSES } from '@/lib/config';
import { calculateYield, INTEREST_UNAVAILABLE, SECONDS_PER_YEAR } from '@/lib/financial';
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
  /** Backend savings summary — the preferred source for interest earned. */
  summary?: SavingsSummaryResponse | null;
  /** Vault identifier ('USDC' | 'FUSE' | 'ETH'). */
  vault?: string;
}

/**
 * Live savings figure for a vault.
 *
 * For the interest modes, the value is a *measurement* of realized profit
 * (`total value - total deposited`) taken at a known instant, plus an APY
 * projection over only the seconds elapsed since that instant. That keeps the
 * counter smooth without letting a rate change retroactively re-price the whole
 * holding period — the behaviour that made "interest earned" fall when the APY
 * dipped.
 *
 * Preferred source is the backend `/savings/summary`, which measures against a
 * high-water-mark exchange rate so the figure never steps backwards on a
 * transient NAV dip. The subgraph calculation is the fallback; if neither can
 * establish realized profit, the last known value is held rather than replaced
 * by a projection.
 */
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
  const [liveYield, setLiveYield] = useState(() => {
    if (balance <= 0 || !isFinite(balance)) return 0;
    if (mode === SavingMode.BALANCE_ONLY) return balance;
    if (mode === SavingMode.TOTAL_USD) return balance * exchangeRate;
    return 0;
  });
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
    // CURRENT mode: prefer the backend summary for every vault. It is measured
    // against a high-water-mark rate and stays valid even if the on-chain balance
    // read is momentarily 0 (slow/failed RPC poll or a vault switch), so it is
    // handled BEFORE the balance<=0 guard — a transient 0 balance must not wipe
    // the anchor and snap interest to 0.
    if (mode === SavingMode.CURRENT && summary) {
      const backendInterest = parseFloat(summary.interestEarnedUSD);
      const calculatedAtUnix = Math.floor(new Date(summary.calculatedAt).getTime() / 1000);
      if (isFinite(backendInterest) && backendInterest >= 0 && calculatedAtUnix > 0) {
        setLiveYield(backendInterest);
        setAnchor({ value: backendInterest, time: calculatedAtUnix });
      }
      return;
    }

    // FUSE has no subgraph to fall back on — hold the current value until the
    // backend summary responds rather than showing a projection.
    if (mode === SavingMode.CURRENT && vault === 'FUSE') {
      return;
    }

    if (balance <= 0) {
      setLiveYield(0);
      setAnchor(null);
      return;
    }
    if (mode === SavingMode.BALANCE_ONLY) {
      setLiveYield(balance);
      setAnchor(null);
      return;
    }
    if (mode === SavingMode.TOTAL_USD) {
      setLiveYield(balance * exchangeRate);
      return;
    }

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
      // Realized profit couldn't be established (no deposit history yet) — keep
      // whatever is on screen instead of substituting a guess.
      if (calculatedYield === INTEREST_UNAVAILABLE) return;
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

  // Every second: update display with simple formula (no network).
  // For CURRENT this projects forward from the anchor only — the elapsed period
  // is already accounted for by the measured value at anchor.time.
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
