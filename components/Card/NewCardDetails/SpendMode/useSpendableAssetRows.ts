import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { base } from 'viem/chains';

import { CardSpendableAsset } from '@/constants/cardSpendableAssets';
import { useBalances } from '@/hooks/useBalances';
import { useCardCredit } from '@/hooks/useCardCredit';
import { useAllCardSpendableAssets, useCardSpendableAssets } from '@/hooks/useCardSpendableBalance';
import { useMainCurrency } from '@/hooks/useMainCurrency';
import { useSpendOrder } from '@/hooks/useSpendOrder';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { showsCardCreditPill } from '@/lib/cardCredit';
import { CardCreditSummary, TokenBalance } from '@/lib/types';
import { matchesAsset, soEurUsdPerShare } from '@/lib/utils/cardSpendable';
import {
  DEFAULT_SPEND_ORDER,
  type SpendAssetKey,
  spendAssetKeyOf,
  spendRank,
} from '@/lib/utils/spendOrder';

/**
 * Which logo a "Spendable assets" row draws: card credit, then the stables, the yield shares
 * (soUSD, soEUR, soETH, soBTC) and, last, the crypto Base can sell (WBTC among them).
 */
export type SpendableAssetIcon =
  | 'cardCredit'
  | 'usdc'
  | 'usdt'
  | 'sousd'
  | 'eurc'
  | 'soeur'
  | 'soeth'
  | 'sobtc'
  | 'cbbtc'
  | 'wbtc'
  | 'weth'
  | 'sol'
  | 'aave'
  | 'zec';

/** One "Spendable assets" row (Figma 29144:9473, 29144:9483, 29144:9495). */
export interface SpendableAssetRow {
  key: string;
  /** The asset's place in the spend order: soUSD on Fuse and on Base share `USD_YIELD`. */
  spendKey?: SpendAssetKey;
  icon: SpendableAssetIcon;
  /** In the asset's own units, for a row that sums several holdings of one asset. */
  amount: number;
  /** "USDC", "soUSD", "EURC". */
  name: string;
  /** "USD Yield", "ETH Yield", "Euro purchases"; absent on a plain stablecoin. */
  subtitle?: string;
  /** "$100.00", or "€74.20" for a euro asset. */
  value: string;
  /** "18.47 soUSD" under a share, "≈ $86.50" under a euro balance. */
  detail?: string;
  /** Dollars this row adds to the balance, or 0 when it cannot be priced. */
  usd: number;
  /**
   * Whether it is a dollar asset — USDC, USDT and soUSD on either chain — rather than a euro one
   * or crypto (soETH included), which a dollar purchase reaches only once the dollars are spent.
   */
  isDollar: boolean;
}

export interface SpendableAssetBreakdown {
  rows: SpendableAssetRow[];
  /** "Your balance": every row, euro assets included at their dollar value. */
  totalUsd: number;
  /** What a dollar purchase can draw on: the dollar rows (USDC, USDT, soUSD on Fuse and on Base). */
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
  soETH: 'soeth',
  // Without these two a Base soBTC or WBTC holding was dropped from the Cash panel without a word,
  // while the backend still spent it.
  soBTC: 'sobtc',
  cbBTC: 'cbbtc',
  WBTC: 'wbtc',
  WETH: 'weth',
  SOL: 'sol',
  AAVE: 'aave',
  cbZEC: 'zec',
};

/** The crypto Base can sell, by name under its ticker. */
const CRYPTO_NAME: Record<string, string> = {
  cbBTC: 'Bitcoin',
  WBTC: 'Wrapped Bitcoin',
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
  order: readonly SpendAssetKey[] = DEFAULT_SPEND_ORDER,
): SpendableAssetBreakdown => {
  const held = tokens ?? [];
  const soEurUsd = soEurUsdPerShare(held, soEurRate, usdPerEur);

  const rows = assets.flatMap((asset, index): SpendableAssetRow[] => {
    const icon = asset.symbol ? ICON_BY_SYMBOL[asset.symbol] : undefined;
    const matching = held.filter(token => matchesAsset(token, asset));
    const amount = matching.reduce((sum, token) => sum + units(token), 0);
    if (!icon || amount <= 0) return [];

    const key = `${asset.symbol}:${index}`;
    const spendKey = spendAssetKeyOf(asset.symbol);
    const usdOf = (token: TokenBalance) => units(token) * (token.quoteRate ?? 0);

    switch (icon) {
      // Not a token: its row comes from `cardCreditAssetRow`.
      case 'cardCredit':
        return [];
      case 'usdc':
      case 'usdt': {
        const usd = matching.reduce((sum, token) => sum + usdOf(token), 0);
        return [
          {
            key,
            spendKey,
            icon,
            amount,
            name: asset.symbol!,
            value: money(usd, 'USD'),
            usd,
            isDollar: true,
          },
        ];
      }
      case 'sousd': {
        const usd = matching.reduce((sum, token) => sum + usdOf(token), 0);
        return [
          {
            key,
            spendKey,
            icon,
            amount,
            name: 'soUSD',
            // soUSD can be held on Fuse and on Base at once, as two rows: name the Base one.
            subtitle: asset.chainIds?.includes(base.id) ? 'USD Yield on Base' : 'USD Yield',
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
            spendKey,
            icon,
            amount,
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
      case 'wbtc':
      case 'weth':
      case 'sol':
      case 'aave':
      case 'zec': {
        const usd = matching.reduce((sum, token) => sum + usdOf(token), 0);
        return [
          {
            key,
            spendKey,
            icon,
            amount,
            name: asset.symbol!,
            subtitle: CRYPTO_NAME[asset.symbol!],
            value: money(usd, 'USD'),
            detail: `${coinAmount(amount)} ${asset.symbol}`,
            usd,
            isDollar: false,
          },
        ];
      }
      case 'soeth': {
        // Priced like any soETH: its accountant rate times ETH, in `quoteRate`.
        const usd = matching.reduce((sum, token) => sum + usdOf(token), 0);
        return [
          {
            key,
            spendKey,
            icon,
            amount,
            name: 'soETH',
            subtitle: 'ETH Yield',
            value: money(usd, 'USD'),
            detail: `${coinAmount(amount)} soETH`,
            usd,
            isDollar: false,
          },
        ];
      }
      case 'sobtc': {
        // Priced like soETH: its accountant rate times BTC, in `quoteRate`.
        const usd = matching.reduce((sum, token) => sum + usdOf(token), 0);
        return [
          {
            key,
            spendKey,
            icon,
            amount,
            name: 'soBTC',
            subtitle: 'BTC Yield',
            value: money(usd, 'USD'),
            detail: `${coinAmount(amount)} soBTC`,
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
            spendKey,
            icon,
            amount,
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

  // In the order the card draws from them, per the cardholder's spend order. Stable, so two rows
  // of one asset (soUSD on Fuse and on Base) keep the allowlist's order between them.
  rows.sort((a, b) => spendRank(order, a.spendKey) - spendRank(order, b.spendKey));

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
        name: 'Card bonus',
        subtitle: 'Used first',
        value: money(credit.availableUsd, 'USD'),
        usd: 0,
        amount: 0,
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

/** {@link buildSpendableAssetRows} for `assets`, in the cardholder's spend order. */
const useRowsFor = (assets: CardSpendableAsset[]): SpendableAssetBreakdown => {
  const { tokens } = useBalances();
  const holdsSoEur = assets.some(asset => asset.symbol === 'soEUR');
  const { data: soEurRate } = useVaultExchangeRate('EUR', holdsSoEur);
  const { usdPerEur } = useMainCurrency();
  const { order } = useSpendOrder();

  return useMemo(
    () => buildSpendableAssetRows(tokens, assets, soEurRate, usdPerEur, order),
    [tokens, assets, soEurRate, usdPerEur, order],
  );
};

/**
 * {@link buildSpendableAssetRows} for the signed-in cardholder, in their spend order and without
 * the assets they excluded — what the Cash panel lists and "Your balance" adds up — with their
 * card credit on top, since every purchase draws on it before any asset below.
 */
export const useSpendableAssetRows = (): SpendableAssetBreakdown => {
  const breakdown = useRowsFor(useCardSpendableAssets());
  // The query the Home pill already keeps warm, so the row is there when the sheet opens rather
  // than growing the panel under the cardholder's thumb.
  const { data: cardCredit } = useCardCredit();

  return useMemo(() => withCardCreditRow(breakdown, cardCredit), [breakdown, cardCredit]);
};

/** Every asset the card could spend, excluded ones included: the Spend order screen's rows. */
export const useAllSpendableAssetRows = (): SpendableAssetBreakdown =>
  useRowsFor(useAllCardSpendableAssets());

export default useSpendableAssetRows;
