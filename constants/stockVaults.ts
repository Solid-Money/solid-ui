import { type Address } from 'viem';

import { type StockVaultType, VaultType } from '@/lib/types';

/**
 * The stock vaults: Veda BoringVaults on Base, each holding one Coinbase tokenized
 * stock (AAPLc, NVDAc…) and earning in it. Shares and stock tokens both have 8
 * decimals, and the accountant rate starts at 1e8 — one share for one stock token —
 * then grows with the yield. The stock token is priced in USD like the stock, so
 * unlike soEURC these vaults count in every USD total.
 *
 * Every per-vault detail the app needs comes from this list, so a ninth stock is one
 * more entry here. The contracts exist on Base mainnet only, and QA builds use the
 * same ones, so the addresses are constants rather than build config.
 *
 * Deposits take the stock token itself, from the Solid wallet: the Safe approves the
 * VAULT and calls the teller (a plain `TellerWithMultiAssetSupport`), like soEURC.
 * Withdrawals go through the vault's `BoringOnChainQueueWithTracking`, solved by a
 * Safe-run solver that pays the stock token back to the Safe.
 */
export type StockTicker = 'AAPL' | 'NVDA' | 'AMZN' | 'MSFT' | 'META' | 'TSLA' | 'GOOGL' | 'SPCX';

export type StockToken = {
  address: Address;
  /** Coinbase's symbol, e.g. `AAPLc`. */
  symbol: string;
  /** The company, e.g. `Apple Inc.`. */
  name: string;
  decimals: number;
};

export type StockVault = {
  ticker: StockTicker;
  type: StockVaultType;
  shareSymbol: string;
  shareName: string;
  shareDecimals: number;
  stockToken: StockToken;
  /** The BoringVault, which is also the share token. */
  vault: Address;
  teller: Address;
  accountant: Address;
  boringQueue: Address;
};

/** Every stock token and share has 8 decimals. */
const STOCK_DECIMALS = 8;

const stockVault = (
  ticker: StockTicker,
  type: StockVaultType,
  stockToken: Omit<StockToken, 'decimals' | 'symbol'>,
  contracts: Pick<StockVault, 'vault' | 'teller' | 'accountant' | 'boringQueue'>,
): StockVault => ({
  ticker,
  type,
  shareSymbol: `so${ticker}`,
  shareName: `Solid ${ticker}`,
  shareDecimals: STOCK_DECIMALS,
  stockToken: { ...stockToken, symbol: `${ticker}c`, decimals: STOCK_DECIMALS },
  ...contracts,
});

/** In the order they were deployed, which is the order they are listed in. */
export const STOCK_VAULTS: readonly StockVault[] = [
  stockVault(
    'AAPL',
    VaultType.AAPL,
    { address: '0xb200000000000000000000C2e324d24d7eEcd1fb', name: 'Apple Inc.' },
    {
      vault: '0xBfe0BF0097D9AB28928ecaCdA3e33366B36517cd',
      teller: '0xE355Ec3b2BffC0E888cefb7e8397fCA5D04AAF70',
      accountant: '0x4680628a36De316773e3DeaA8CdF44561F60F8DF',
      boringQueue: '0xA764c1Ab9A1De069Fc201A209C306337Ed72f7D9',
    },
  ),
  stockVault(
    'NVDA',
    VaultType.NVDA,
    { address: '0xb20000000000000000000078ee7ce2fE4908108C', name: 'NVIDIA Corporation' },
    {
      vault: '0x801FBB9b163271893a62dFB8568b94f4A067B9Cb',
      teller: '0x862dfB8849970dEF39A1E8d12ad2024800C575f3',
      accountant: '0xef6131Cf3E4092ADffD932E5992BA373B8f8875B',
      boringQueue: '0x32ef63A5a7c971AA4Cf57f27FEB9Fc6936B9eAa7',
    },
  ),
  stockVault(
    'AMZN',
    VaultType.AMZN,
    { address: '0xb200000000000000000000d9192b6B456483C2E8', name: 'Amazon.com Inc.' },
    {
      vault: '0xb18892DA9964D0AcB29BCfEFd4E79A63c71Ace3D',
      teller: '0x8757Df06Ee059a627430e0D3EeDAB8CF87C84F2f',
      accountant: '0x04C576fd32d4E5733Ac922c53221b4E8AA60AB87',
      boringQueue: '0x29A0DD7d47CE49188b96B784feCe2c18726DE6A8',
    },
  ),
  stockVault(
    'MSFT',
    VaultType.MSFT,
    { address: '0xB200000000000000000000Ab99cFa739E253872B', name: 'Microsoft Corporation' },
    {
      vault: '0xf8aA640c64F9920A6609C680551670239233ba19',
      teller: '0xB5Dd0F522eafA7F8344919644F4C3F7d1b419597',
      accountant: '0xD8833EeBCCfe9b01f442c5244b8F20C69296D4Dd',
      boringQueue: '0xa5c81ba0BF47500ecBa5c76172EB5755C0D49CbB',
    },
  ),
  stockVault(
    'META',
    VaultType.META,
    { address: '0xb2000000000000000000008bC8786B856E61707C', name: 'Meta Platforms Inc.' },
    {
      vault: '0x79df65b0Db55F044C1AA6d223E9759EF87830e1F',
      teller: '0xe4c6573A4ad90faA579ddD8541864AB5BfC410D6',
      accountant: '0x3768165FCe98d5cc03dd46a636eF4b986a15E762',
      boringQueue: '0xaA23C7f72DB49402d835Ad7C6908ba1aD4C91066',
    },
  ),
  stockVault(
    'TSLA',
    VaultType.TSLA,
    { address: '0xb2000000000000000000001e800a7f5189430cD0', name: 'Tesla Inc.' },
    {
      vault: '0xA684417Baad4ba0EFE9657081F972f278e8fefB5',
      teller: '0x4D86058FB72945EC34ae1A3dAC257811fd0f2D48',
      accountant: '0xD2Ad55c55489f55dd68dd2bFC6cA721BBFab6AC8',
      boringQueue: '0x1C883c80BE5b9BdE5F18f80c7fc264BC875CE704',
    },
  ),
  stockVault(
    'GOOGL',
    VaultType.GOOGL,
    { address: '0xb2000000000000000000002D0BA3164cc74f58B7', name: 'Alphabet Inc.' },
    {
      vault: '0x0311d575c843A64c8114a665e75BB9b6b830c1b4',
      teller: '0xC044fb6B71c8f15a7D1e3802237CA919f7F13857',
      accountant: '0x6E01c2560109DaA65106D3Dc27886a71Da94379b',
      boringQueue: '0xb662Fb1E23A2183d93e442EC43B911D7eAdcF4b1',
    },
  ),
  stockVault(
    'SPCX',
    VaultType.SPCX,
    {
      address: '0xb2000000000000000000007b9fcbd005511aCBd5',
      name: 'Space Exploration Technologies Corp.',
    },
    {
      vault: '0x48B6ce342AA649f0fA5C15ee21b01B0dAd114d59',
      teller: '0x56D16294982cf8c94c8286a81c486C0Caa61E5fC',
      accountant: '0x23d5907A726DB400b4CC654aF3ee91Ecbd885663',
      boringQueue: '0xA369e74108c4094Ca0270FEd778D58B3Bf5270e8',
    },
  ),
];

export const STOCK_VAULT_TYPES: readonly StockVaultType[] = STOCK_VAULTS.map(stock => stock.type);

/**
 * The smallest deposit, in stock units: a thousandth of a share, cents to a dollar
 * at today's prices. Far above the queue's 100-unit minimum withdrawal, so anything
 * deposited can be withdrawn again.
 */
export const STOCK_VAULT_MINIMUM_DEPOSIT = '0.001';

export const isStockVaultType = (type: VaultType | string | undefined): type is StockVaultType =>
  STOCK_VAULT_TYPES.includes(type as StockVaultType);

export const getStockVault = (type: VaultType | undefined): StockVault | undefined =>
  STOCK_VAULTS.find(stock => stock.type === type);

/** The stock vault of a ticker (`AAPL`), case-insensitive. */
export const getStockVaultByTicker = (ticker: string | undefined): StockVault | undefined => {
  const upper = typeof ticker === 'string' ? ticker.toUpperCase() : undefined;
  return STOCK_VAULTS.find(stock => stock.ticker === upper);
};

/** The stock vault whose share symbol (`soAAPL`) this is, case-insensitive. */
export const getStockVaultByShareSymbol = (symbol: string | undefined): StockVault | undefined => {
  // Persisted activity rows can be corrupt; never call toLowerCase on a non-string.
  if (typeof symbol !== 'string' || !symbol) return undefined;
  const lower = symbol.toLowerCase();
  return STOCK_VAULTS.find(stock => stock.shareSymbol.toLowerCase() === lower);
};

/** The stock vault whose share token sits at this address on Base. */
export const getStockVaultByShareAddress = (
  address: string | undefined,
): StockVault | undefined => {
  const lower = address?.toLowerCase();
  return lower ? STOCK_VAULTS.find(stock => stock.vault.toLowerCase() === lower) : undefined;
};

/** The stock vault taking this stock token (`AAPLc`), by address on Base. */
export const getStockVaultByStockAddress = (
  address: string | undefined,
): StockVault | undefined => {
  const lower = address?.toLowerCase();
  return lower
    ? STOCK_VAULTS.find(stock => stock.stockToken.address.toLowerCase() === lower)
    : undefined;
};

/** The stock vault taking this stock token, by its symbol (`AAPLc`), case-insensitive. */
export const getStockVaultByStockSymbol = (symbol: string | undefined): StockVault | undefined => {
  const upper = typeof symbol === 'string' ? symbol.toUpperCase() : undefined;
  return upper
    ? STOCK_VAULTS.find(stock => stock.stockToken.symbol.toUpperCase() === upper)
    : undefined;
};

/**
 * One entry per stock vault, keyed by its vault type — for spreading into the maps
 * that are keyed by every vault type, so they never need eight hand-written lines.
 */
export const byStockVaultType = <T>(value: (stock: StockVault) => T): Record<StockVaultType, T> =>
  Object.fromEntries(STOCK_VAULTS.map(stock => [stock.type, value(stock)])) as Record<
    StockVaultType,
    T
  >;

/** {@link byStockVaultType}, keyed by ticker instead. */
export const byStockTicker = <T>(value: (stock: StockVault) => T): Record<StockTicker, T> =>
  Object.fromEntries(STOCK_VAULTS.map(stock => [stock.ticker, value(stock)])) as Record<
    StockTicker,
    T
  >;
