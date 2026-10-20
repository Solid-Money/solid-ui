import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { base } from 'viem/chains';

import { CardSpendableAsset } from '@/constants/cardSpendableAssets';
import { useBalances } from '@/hooks/useBalances';
import { useCardSpendableAssets } from '@/hooks/useCardSpendableBalance';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { TokenBalance } from '@/lib/types';
import { matchesAsset } from '@/lib/utils/cardSpendable';

/** Which logo a "Spendable assets" row draws. */
export type SpendableAssetIcon = 'usdc' | 'usdt' | 'sousd' | 'eurc' | 'soeur';

/** One "Spendable assets" row (Figma 29144:9473, 29144:9483, 29144:9495). */
export interface SpendableAssetRow {
  key: string;
  icon: SpendableAssetIcon;
  /** "USDC", "soUSD", "EURC". */
  name: string;
  /** "USD Yield", "Euro purchases"; absent on a plain stablecoin. */
  subtitle?: string;
  /** "$100.00", or "€74.20" for a euro asset. */
  value: string;
  /** "18.47 soUSD" under a share, "≈ $86.50" under a euro balance. */
  detail?: string;
  /** Dollars this row adds to the balance, or 0 when it cannot be priced. */
  usd: number;
  /** Whether it pays for a dollar purchase — true for the Fuse set, false for the euro assets. */
  isDollar: boolean;
}

export interface SpendableAssetBreakdown {
  rows: SpendableAssetRow[];
  /** "Your balance": every row, euro assets included at their dollar value. */
  totalUsd: number;
  /** What a dollar purchase can draw on: the Fuse set alone, which is what Cash spends. */
  dollarUsd: number;
}

const money = (amount: number, currency: 'USD' | 'EUR'): string =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const units = (token: TokenBalance): number => {
  let raw: bigint;
  try {
    raw = BigInt(token.balance ?? 0);
  } catch {
    return 0;
  }
  return raw > 0n ? Number(formatUnits(raw, token.contractDecimals)) : 0;
};

const ICON_BY_SYMBOL: Record<string, SpendableAssetIcon> = {
  USDC: 'usdc',
  USDT: 'usdt',
  soUSD: 'sousd',
  EURC: 'eurc',
  soEUR: 'soeur',
};

/**
 * The breakdown under "Your balance", in the order the card draws from: one row per spendable
 * asset the Safe holds, matched on the same addresses the Spendable total uses.
 *
 * Dollar assets are valued at their USD quote. EURC is a euro balance, so it reads in euros with
 * its dollar value under it. soEUR has no USD quote (`useBalances` keeps it in euros), so it is
 * valued at the soEUR accountant rate in euros, and in dollars through the same instance's EURC
 * quote when the Safe holds EURC to quote from.
 *
 * Pure, so the rules can be tested without the queries behind them.
 */
export const buildSpendableAssetRows = (
  tokens: TokenBalance[] | undefined,
  assets: CardSpendableAsset[],
  soEurRate: number | undefined,
): SpendableAssetBreakdown => {
  const held = tokens ?? [];
  const eurcUsdQuote = held.find(
    token =>
      token.chainId === base.id &&
      token.contractTickerSymbol?.toUpperCase() === 'EURC' &&
      (token.quoteRate ?? 0) > 0,
  )?.quoteRate;

  const rows = assets.flatMap((asset, index): SpendableAssetRow[] => {
    const icon = asset.symbol ? ICON_BY_SYMBOL[asset.symbol] : undefined;
    const matching = held.filter(token => matchesAsset(token, asset));
    const amount = matching.reduce((sum, token) => sum + units(token), 0);
    if (!icon || amount <= 0) return [];

    const key = `${asset.symbol}:${index}`;
    const usdOf = (token: TokenBalance) => units(token) * (token.quoteRate ?? 0);

    switch (icon) {
      case 'usdc':
      case 'usdt': {
        const usd = matching.reduce((sum, token) => sum + usdOf(token), 0);
        return [{ key, icon, name: asset.symbol!, value: money(usd, 'USD'), usd, isDollar: true }];
      }
      case 'sousd': {
        const usd = matching.reduce((sum, token) => sum + usdOf(token), 0);
        return [
          {
            key,
            icon,
            name: 'soUSD',
            subtitle: 'USD Yield',
            value: money(usd, 'USD'),
            detail: `${amount.toFixed(2)} soUSD`,
            usd,
            isDollar: true,
          },
        ];
      }
      case 'eurc': {
        const usd = matching.reduce((sum, token) => sum + usdOf(token), 0);
        return [
          {
            key,
            icon,
            name: 'EURC',
            subtitle: 'Euro purchases',
            value: money(amount, 'EUR'),
            detail: usd > 0 ? `≈ ${money(usd, 'USD')}` : undefined,
            usd,
            isDollar: false,
          },
        ];
      }
      case 'soeur': {
        const eur = soEurRate ? amount * soEurRate : undefined;
        const usd = eur !== undefined && eurcUsdQuote ? eur * eurcUsdQuote : 0;
        return [
          {
            key,
            icon,
            name: 'soEUR',
            subtitle: 'EUR Yield',
            value: eur !== undefined ? money(eur, 'EUR') : `${amount.toFixed(2)} soEUR`,
            detail: eur !== undefined ? `${amount.toFixed(2)} soEUR` : undefined,
            usd,
            isDollar: false,
          },
        ];
      }
    }
  });

  return {
    rows,
    totalUsd: rows.reduce((sum, row) => sum + row.usd, 0),
    dollarUsd: rows.filter(row => row.isDollar).reduce((sum, row) => sum + row.usd, 0),
  };
};

/** {@link buildSpendableAssetRows} for the signed-in cardholder. */
export const useSpendableAssetRows = (): SpendableAssetBreakdown => {
  const { tokens } = useBalances();
  const assets = useCardSpendableAssets();
  const holdsSoEur = assets.some(asset => asset.symbol === 'soEUR');
  const { data: soEurRate } = useVaultExchangeRate('EUR', holdsSoEur);

  return useMemo(
    () => buildSpendableAssetRows(tokens, assets, soEurRate),
    [tokens, assets, soEurRate],
  );
};

export default useSpendableAssetRows;
