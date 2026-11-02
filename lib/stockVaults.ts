import { type Address, erc20Abi, formatUnits } from 'viem';
import { base } from 'viem/chains';

import { STOCK_VAULTS, type StockVault } from '@/constants/stockVaults';
import Accountant from '@/lib/abis/Accountant';
import { fetchTokenPricesByAddress } from '@/lib/api';
import { savingsUsdValue } from '@/lib/portfolio';
import { StockVaultType } from '@/lib/types';
import { publicClient } from '@/lib/wagmi';

/**
 * What a stock vault position is worth. A share is worth `rate` of the stock token
 * (the accountant's rate, 8 decimals), and the stock token is priced in USD like the
 * stock, from Alchemy's prices by address. So a position is
 * `shares × rate × stock price` dollars, and `shares × rate` stock tokens.
 *
 * Unlike soEURC, these count in every USD total.
 */
export type StockVaultHolding = {
  /** Shares held in the Safe. Undefined when the balance could not be read. */
  shares: number | undefined;
  /** Stock tokens per share. Undefined when the accountant could not be read. */
  rate: number | undefined;
  /** USD per stock token. Undefined when there is no price, or nothing held to price. */
  priceUsd: number | undefined;
  /** What the shares redeem for, in stock tokens. */
  underlying: number | undefined;
  /** What the shares are worth in USD: 0 for none, undefined when it cannot be valued. */
  valueUsd: number | undefined;
};

const priceKey = (stock: StockVault) => `${base.id}:${stock.stockToken.address.toLowerCase()}`;

/** USD per stock token for `stocks`, keyed by vault type. A stock without a price is left out. */
export const fetchStockTokenPrices = async (
  stocks: readonly StockVault[],
): Promise<Partial<Record<StockVaultType, number>>> => {
  if (stocks.length === 0) return {};
  const prices = await fetchTokenPricesByAddress(
    stocks.map(stock => ({ chainId: base.id, address: stock.stockToken.address })),
  );
  const byType: Partial<Record<StockVaultType, number>> = {};
  for (const stock of stocks) {
    const price = prices[priceKey(stock)];
    if (price !== undefined && price > 0) byType[stock.type] = price;
  }
  return byType;
};

/** Stock tokens per share for `stocks`, keyed by vault type, in one multicall. */
export const fetchStockVaultRates = async (
  stocks: readonly StockVault[],
): Promise<Partial<Record<StockVaultType, number>>> => {
  if (stocks.length === 0) return {};
  const results = await publicClient(base.id).multicall({
    contracts: stocks.map(stock => ({
      address: stock.accountant,
      abi: Accountant,
      functionName: 'getRate' as const,
    })),
    allowFailure: true,
  });
  const byType: Partial<Record<StockVaultType, number>> = {};
  stocks.forEach((stock, i) => {
    const result = results[i];
    if (result.status === 'success') {
      byType[stock.type] = Number(formatUnits(result.result as bigint, stock.shareDecimals));
    }
  });
  return byType;
};

/** A position valued from its parts; see {@link StockVaultHolding}. */
export const stockVaultHolding = (
  shares: number | undefined,
  rate: number | undefined,
  priceUsd: number | undefined,
): StockVaultHolding => ({
  shares,
  rate,
  priceUsd,
  underlying:
    shares === undefined ? undefined : shares === 0 ? 0 : rate ? shares * rate : undefined,
  valueUsd: savingsUsdValue(shares, rate, priceUsd ?? 0),
});

/**
 * Every stock vault position of `safeAddress`, keyed by vault type: the share
 * balances and rates in one multicall on Base, then prices for the stocks held.
 * Nothing is priced for a stock the Safe holds no shares of.
 */
export const fetchStockVaultHoldings = async (
  safeAddress: Address,
): Promise<Record<StockVaultType, StockVaultHolding>> => {
  const results = await publicClient(base.id).multicall({
    contracts: STOCK_VAULTS.flatMap(stock => [
      {
        address: stock.vault,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [safeAddress] as const,
      },
      { address: stock.accountant, abi: Accountant, functionName: 'getRate' as const },
    ]),
    allowFailure: true,
  });
  const read = (index: number) => {
    const result = results[index];
    return result.status === 'success' ? (result.result as bigint) : undefined;
  };

  const parts = STOCK_VAULTS.map((stock, i) => {
    const balance = read(i * 2);
    const rate = read(i * 2 + 1);
    return {
      stock,
      shares: balance === undefined ? undefined : Number(formatUnits(balance, stock.shareDecimals)),
      rate: rate === undefined ? undefined : Number(formatUnits(rate, stock.shareDecimals)),
    };
  });
  const prices = await fetchStockTokenPrices(
    parts.filter(part => (part.shares ?? 0) > 0).map(part => part.stock),
  );

  return Object.fromEntries(
    parts.map(({ stock, shares, rate }) => [
      stock.type,
      stockVaultHolding(shares, rate, prices[stock.type]),
    ]),
  ) as Record<StockVaultType, StockVaultHolding>;
};
