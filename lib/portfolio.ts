import { formatUnits, zeroAddress } from 'viem';

import { isDisplayStablecoin } from '@/constants/stablecoins';
import { VAULTS } from '@/constants/vaults';
import { ADDRESSES } from '@/lib/config';
import { TokenBalance, TokenType, VaultType } from '@/lib/types';

export type PortfolioAsset = {
  id: string;
  symbol: string;
  name: string;
  balance: number;
  valueUsd: number | undefined;
  tokens: TokenBalance[];
  networkCount: number;
  backsCredit: boolean;
  heldInWallet: boolean;
  /** Grouped under Stablecoins; everything else that is not a vault share is Crypto. */
  stable: boolean;
};

export const savingsUsdValue = (
  shares: number | undefined,
  rate: number | undefined,
  price: number | undefined = 1,
): number | undefined => {
  if (shares === undefined || !Number.isFinite(shares) || shares < 0) return undefined;
  if (shares === 0) return 0;
  if (!rate || !price || !Number.isFinite(rate) || !Number.isFinite(price) || rate < 0 || price < 0)
    return undefined;
  const value = shares * rate * price;
  return Number.isFinite(value) ? value : undefined;
};

export const portfolioVaultType = (address: string, chainId: number): VaultType | undefined => {
  const lower = address?.toLowerCase();
  return VAULTS.find(vault =>
    vault.vaults.some(
      network => network.chainId === chainId && network.address.toLowerCase() === lower,
    ),
  )?.type;
};

/**
 * A vault share matched by address on any chain. soUSD is bridged to Base and Arbitrum under
 * the same address as the Ethereum vault, but VAULTS only lists the chains we read savings on.
 *
 * soEURC is recognised whether or not this build lists its vault, so a soEURC balance is
 * never mistaken for wallet cash (and priced in dollars) in a build that hides the vault.
 */
export const portfolioShareVaultType = (address: string): VaultType | undefined => {
  const lower = address?.toLowerCase();
  if (lower && lower === ADDRESSES.base.soEurcVault.toLowerCase()) return VaultType.EUR;
  return VAULTS.find(vault => vault.vaults.some(network => network.address.toLowerCase() === lower))
    ?.type;
};

/**
 * Wallet shares on chains the savings read skips, valued at their accountant rate, in USD.
 * soEURC is never valued here: it is held in EUR and does not enter a USD total.
 */
export const bridgedShareValues = (tokens: TokenBalance[]) => {
  const values: Partial<Record<VaultType, number | undefined>> = {};
  for (const token of tokens) {
    const type = portfolioShareVaultType(token.contractAddress);
    if (!type || type === VaultType.EUR) continue;
    if (portfolioVaultType(token.contractAddress, token.chainId)) continue;
    if (BigInt(token.balance || '0') <= 0n) continue;
    const value = savingsUsdValue(
      Number(formatUnits(BigInt(token.balance), token.contractDecimals)),
      token.quoteRate,
    );
    const current = type in values ? values[type] : 0;
    values[type] = current !== undefined && value !== undefined ? current + value : undefined;
  }
  return values;
};

/**
 * A vault's share token as the user holds it: wallet shares on every network (savings and
 * bridged alike) plus shares escrowed as credit collateral. The wallet shares, largest first,
 * are what the Earn row opens; escrowed shares have no coin page of their own.
 */
export const vaultShareHoldings = (
  tokens: TokenBalance[],
  collateral: TokenBalance[],
  type: VaultType,
) => {
  const held = (list: TokenBalance[]) =>
    list
      .filter(
        token =>
          portfolioShareVaultType(token.contractAddress) === type &&
          BigInt(token.balance || '0') > 0n,
      )
      .map(token => ({
        token,
        amount: Number(formatUnits(BigInt(token.balance), token.contractDecimals)),
      }));
  const wallet = held(tokens).sort((a, b) => b.amount - a.amount);
  const escrowed = held(collateral);
  const all = [...wallet, ...escrowed];
  const total = (list: { amount: number }[]) => list.reduce((sum, item) => sum + item.amount, 0);
  return {
    walletTokens: wallet.map(item => item.token),
    shareAmount: all.length ? total(all) : undefined,
    /** Shares the user can move: in the wallet, on any network. */
    walletShareAmount: total(wallet),
    /** Shares locked as credit collateral; they come back on repay. */
    escrowedShareAmount: total(escrowed),
    shareNetworkCount: new Set(all.map(item => item.token.chainId)).size,
  };
};

/**
 * The yield pill: per day once that reaches a cent, else per month, else nothing. A small
 * balance would otherwise read "+<$0.01 / day".
 */
export const yieldEstimate = (
  daily: number | undefined,
  monthly: number | undefined,
): { amount: number; period: 'day' | 'month' } | undefined => {
  if (daily !== undefined && Number.isFinite(daily) && daily >= 0.01)
    return { amount: daily, period: 'day' };
  if (monthly !== undefined && Number.isFinite(monthly) && monthly >= 0.01)
    return { amount: monthly, period: 'month' };
  return undefined;
};

/** Only a curated commonId can merge ERC20s across networks, never a ticker alone. */
export const portfolioAssetId = (token: TokenBalance): string =>
  token.commonId
    ? `common:${token.commonId}`
    : token.type === TokenType.NATIVE
      ? `native:${token.contractTickerSymbol}`
      : `${token.chainId}:${token.contractAddress.toLowerCase()}`;

export const coinAssetPath = (token: TokenBalance) =>
  `/coins/${token.chainId}-${token.type === TokenType.NATIVE ? zeroAddress : token.contractAddress}` as const;

export function groupPortfolioCash(
  tokens: TokenBalance[],
  collateral: TokenBalance[] = [],
): PortfolioAsset[] {
  const groups = new Map<string, PortfolioAsset>();
  for (const [holdings, backsCredit] of [
    [tokens, false],
    [collateral, true],
  ] as const) {
    for (const token of holdings) {
      if (portfolioShareVaultType(token.contractAddress) || BigInt(token.balance || '0') <= 0n)
        continue;
      const balance = Number(formatUnits(BigInt(token.balance), token.contractDecimals));
      const valueUsd = savingsUsdValue(balance, token.quoteRate);
      const id = portfolioAssetId(token);
      const group = groups.get(id);
      if (group) {
        group.balance += balance;
        group.valueUsd =
          group.valueUsd !== undefined && valueUsd !== undefined
            ? group.valueUsd + valueUsd
            : undefined;
        // Keep wallet tokens first: their existing coin screen owns networks and history.
        group.tokens.push(token);
        group.networkCount = new Set(group.tokens.map(item => item.chainId)).size;
        group.backsCredit ||= backsCredit;
        group.heldInWallet ||= !backsCredit;
      } else {
        groups.set(id, {
          id,
          symbol: token.contractTickerSymbol,
          name: token.contractName,
          balance,
          valueUsd,
          tokens: [token],
          networkCount: 1,
          backsCredit,
          heldInWallet: !backsCredit,
          stable: isDisplayStablecoin(token.contractTickerSymbol),
        });
      }
    }
  }
  return [...groups.values()].sort(
    (a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1) || a.id.localeCompare(b.id),
  );
}

export const sumPortfolioValues = (values: (number | undefined)[]): number | undefined => {
  if (!values.every(value => value !== undefined && Number.isFinite(value))) return undefined;
  const total = (values as number[]).reduce((sum, value) => sum + value, 0);
  return Number.isFinite(total) ? total : undefined;
};

export const splitSmallBalances = (assets: PortfolioAsset[], threshold = 1) => ({
  visible: assets.filter(asset => asset.valueUsd === undefined || asset.valueUsd >= threshold),
  small: assets.filter(asset => asset.valueUsd !== undefined && asset.valueUsd < threshold),
});

/**
 * Sum what is known and say whether anything is missing. A missing part is never counted as
 * zero, but it also never hides the parts that did load: the screen shows the partial figure
 * and marks it incomplete.
 */
export const sumKnownValues = (values: (number | undefined)[]) => {
  const known = values.filter(
    (value): value is number => value !== undefined && Number.isFinite(value),
  );
  return {
    total: known.length ? known.reduce((sum, value) => sum + value, 0) : undefined,
    complete: known.length === values.length,
  };
};

/** Cash valued from priced holdings only; unpriced holdings are counted, not valued at $0. */
export const cashValue = (assets: PortfolioAsset[]) => {
  const { total, complete } = sumKnownValues(assets.map(asset => asset.valueUsd));
  return {
    total: total ?? 0,
    unpricedCount: complete ? 0 : assets.filter(asset => asset.valueUsd === undefined).length,
  };
};

export const portfolioTotals = ({
  earn,
  locked,
  cash,
  card,
  withdrawing = 0,
  debt,
  complete = true,
}: {
  earn: number | undefined;
  locked: number | undefined;
  cash: number | undefined;
  card: number | undefined;
  /** Withdrawals between savings and wallet: requested from the queue, not yet paid out. */
  withdrawing?: number;
  debt: number | undefined;
  /** False when a part already summed above is itself partial (a failed network, say). */
  complete?: boolean;
}) => {
  const parts = sumKnownValues([earn, locked, cash, card]);
  // Never the only known part: on its own it would turn "balances unavailable" into a figure.
  const assets = {
    ...parts,
    total: parts.total === undefined ? undefined : parts.total + withdrawing,
  };
  return {
    totalAssets: assets.total,
    netBalance: assets.total === undefined ? undefined : assets.total - (debt ?? 0),
    isComplete: complete && assets.complete && debt !== undefined,
  };
};

const formatDecimals = (amount: number, max: number, min: number) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: max,
    minimumFractionDigits: Math.min(min, max),
  }).format(amount);

/**
 * Token quantities kept short: stablecoins to the cent; other tokens to 4 decimals, 2 above
 * 1,000, and about 4 significant digits below 1 (0.0091 ETH).
 */
export const formatTokenAmount = (amount: number, stable = false): string => {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  if (stable || amount >= 1000) return amount < 0.01 ? '<0.01' : formatDecimals(amount, 2, 2);
  if (amount >= 1) return formatDecimals(amount, 4, 2);
  const decimals = Math.min(8, Math.ceil(-Math.log10(amount)) + 3);
  return formatDecimals(amount, decimals, 0);
};

/** The Cash group's figure: wallet cash plus a card that holds its own balance. */
export const cashGroupTotal = (cash: number | undefined, card: number | undefined) =>
  sumKnownValues([cash, card]).total;
