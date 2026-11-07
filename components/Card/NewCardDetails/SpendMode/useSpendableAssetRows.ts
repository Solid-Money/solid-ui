import { useMemo } from 'react';
import { formatUnits } from 'viem';

import { CardSpendableAsset } from '@/constants/cardSpendableAssets';
import { useBalances } from '@/hooks/useBalances';
import { useCardCredit } from '@/hooks/useCardCredit';
import { useCardSpendableAssets } from '@/hooks/useCardSpendableBalance';
import { useMainCurrency } from '@/hooks/useMainCurrency';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { showsCardCreditPill } from '@/lib/cardCredit';
import { CardCreditSummary, TokenBalance } from '@/lib/types';
import { matchesAsset, soEurUsdPerShare } from '@/lib/utils/cardSpendable';

/**
 * Which logo a "Spendable assets" row draws: card credit, then the tokens. The last five are the
 * crypto Base can sell.
 */
export type SpendableAssetIcon =
  | 'cardCredit'
  | 'usdc'
  | 'usdt'
  | 'sousd'
  | 'eurc'
  | 'soeur'
  | 'cbbtc'
  | 'weth'
  | 'sol'
  | 'aave'
  | 'zec';

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
  /**
   * Whether it is a dollar asset — USDC, USDT and soUSD on either chain — rather than a euro one
   * or crypto, which a dollar purchase reaches only once the dollars are spent.
   */
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
  cbBTC: 'cbbtc',
  WETH: 'weth',
  SOL: 'sol',
  AAVE: 'aave',
  cbZEC: 'zec',
};

/** The crypto Base can sell, by name under its ticker. */
const CRYPTO_NAME: Record<string, string> = {
  cbBTC: 'Bitcoin',
  WETH: 'Ethereum',
  SOL: 'Solana',
  AAVE: 'Aave',
  cbZEC: 'Zcash',
};

/** "0.0012" for a fraction of a coin, "1,234.5" for many: four significant figures below one. */
const coinAmount = (amount: number): string =>
  amount < 1
    ? amount.toLocaleString('en-US', { maximumSignificantDigits: 4 })
    : amount.toLocaleString('en-US', { maximumFractionDigits: 4 });

/**
 * The breakdown under "Your balance", in the order the card draws from: one row per spendable
 * asset the Safe holds, matched on the same addresses the Spendable total uses.
 *
 * Dollar assets are valued at their USD quote. EURC is a euro balance, so it reads in euros with
 * its dollar value under it. soEUR has no USD quote (`useBalances` keeps it in euros), so it is
 * valued at the soEUR accountant rate in euros, and in dollars through the Safe's EURC quote — or,
 * when it holds no EURC to quote from, the card's own euro rate. Without that fallback a Safe with
 * soEUR and no EURC counted the soEUR as $0, and "Your balance" showed soUSD alone.
 *
 * Pure, so the rules can be tested without the queries behind them.
 */
export const buildSpendableAssetRows = (
  tokens: TokenBalance[] | undefined,
  assets: CardSpendableAsset[],
  soEurRate: number | undefined,
  usdPerEur?: number,
): SpendableAssetBreakdown => {
  const held = tokens ?? [];
  const soEurUsd = soEurUsdPerShare(held, soEurRate, usdPerEur);

  const rows = assets.flatMap((asset, index): SpendableAssetRow[] => {
    const icon = asset.symbol ? ICON_BY_SYMBOL[asset.symbol] : undefined;
    const matching = held.filter(token => matchesAsset(token, asset));
    const amount = matching.reduce((sum, token) => sum + units(token), 0);
    if (!icon || amount <= 0) return [];

    const key = `${asset.symbol}:${index}`;
    const usdOf = (token: TokenBalance) => units(token) * (token.quoteRate ?? 0);

    switch (icon) {
      // Not a token: its row comes from `cardCreditAssetRow`.
      case 'cardCredit':
        return [];
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
      case 'cbbtc':
      case 'weth':
      case 'sol':
      case 'aave':
      case 'zec': {
        const usd = matching.reduce((sum, token) => sum + usdOf(token), 0);
        return [
          {
            key,
            icon,
            name: asset.symbol!,
            subtitle: CRYPTO_NAME[asset.symbol!],
            value: money(usd, 'USD'),
            detail: `${coinAmount(amount)} ${asset.symbol}`,
            usd,
            isDollar: false,
          },
        ];
      }
      case 'soeur': {
        const eur = soEurRate ? amount * soEurRate : undefined;
        const usd = soEurUsd ? amount * soEurUsd : 0;
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

/**
 * Card credit's row: what is left of it, "Used first", since every purchase draws on it before
 * any asset below. Only while it can be spent — the Home pill's rule, so a user without an active
 * card is not told it pays for anything.
 *
 * Listed, never added: card credit is a balance of its own, so it is in neither "Your balance"
 * nor the dollars a purchase can draw on.
 */
export const cardCreditAssetRow = (
  credit: CardCreditSummary | null | undefined,
): SpendableAssetRow | null =>
  credit && showsCardCreditPill(credit)
    ? {
        key: 'card-credit',
        icon: 'cardCredit',
        name: 'Card credit',
        subtitle: 'Used first',
        value: money(credit.availableUsd, 'USD'),
        usd: 0,
        isDollar: false,
      }
    : null;

/** The breakdown with card credit's row on top, the totals untouched. */
export const withCardCreditRow = (
  breakdown: SpendableAssetBreakdown,
  credit: CardCreditSummary | null | undefined,
): SpendableAssetBreakdown => {
  const row = cardCreditAssetRow(credit);
  return row ? { ...breakdown, rows: [row, ...breakdown.rows] } : breakdown;
};

/** {@link buildSpendableAssetRows} for the signed-in cardholder, with their card credit on top. */
export const useSpendableAssetRows = (): SpendableAssetBreakdown => {
  const { tokens } = useBalances();
  const assets = useCardSpendableAssets();
  const holdsSoEur = assets.some(asset => asset.symbol === 'soEUR');
  const { data: soEurRate } = useVaultExchangeRate('EUR', holdsSoEur);
  const { usdPerEur } = useMainCurrency();
  // The query the Home pill already keeps warm, so the row is there when the sheet opens rather
  // than growing the panel under the cardholder's thumb.
  const { data: cardCredit } = useCardCredit();

  return useMemo(
    () =>
      withCardCreditRow(buildSpendableAssetRows(tokens, assets, soEurRate, usdPerEur), cardCredit),
    [tokens, assets, soEurRate, usdPerEur, cardCredit],
  );
};

export default useSpendableAssetRows;
