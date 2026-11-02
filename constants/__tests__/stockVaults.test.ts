import { getAddress } from 'viem';
import { base } from 'viem/chains';

import {
  getStockVault,
  getStockVaultByShareAddress,
  getStockVaultByShareSymbol,
  getStockVaultByStockSymbol,
  isStockVaultType,
  STOCK_VAULT_MINIMUM_DEPOSIT,
  STOCK_VAULT_TYPES,
  STOCK_VAULTS,
} from '@/constants/stockVaults';
import { VAULTS } from '@/constants/vaults';
import { getVaultKey, isSolidTokenSymbol, VAULT_META } from '@/constants/withdraw';
import { VaultType } from '@/lib/types';
import { getAllowedTokensForChain, getDefaultDepositSelection } from '@/lib/vaults';

// What was deployed on Base (chain 8453) and read back from the contracts on 2026-11-01:
// every share and stock token has 8 decimals, and every accountant started at 1e8.
const DEPLOYED = {
  AAPL: {
    stock: '0xb200000000000000000000C2e324d24d7eEcd1fb',
    vault: '0xBfe0BF0097D9AB28928ecaCdA3e33366B36517cd',
  },
  NVDA: {
    stock: '0xb20000000000000000000078ee7ce2fE4908108C',
    vault: '0x801FBB9b163271893a62dFB8568b94f4A067B9Cb',
  },
  AMZN: {
    stock: '0xb200000000000000000000d9192b6B456483C2E8',
    vault: '0xb18892DA9964D0AcB29BCfEFd4E79A63c71Ace3D',
  },
  MSFT: {
    stock: '0xB200000000000000000000Ab99cFa739E253872B',
    vault: '0xf8aA640c64F9920A6609C680551670239233ba19',
  },
  META: {
    stock: '0xb2000000000000000000008bC8786B856E61707C',
    vault: '0x79df65b0Db55F044C1AA6d223E9759EF87830e1F',
  },
  TSLA: {
    stock: '0xb2000000000000000000001e800a7f5189430cD0',
    vault: '0xA684417Baad4ba0EFE9657081F972f278e8fefB5',
  },
  GOOGL: {
    stock: '0xb2000000000000000000002D0BA3164cc74f58B7',
    vault: '0x0311d575c843A64c8114a665e75BB9b6b830c1b4',
  },
  SPCX: {
    stock: '0xb2000000000000000000007b9fcbd005511aCBd5',
    vault: '0x48B6ce342AA649f0fA5C15ee21b01B0dAd114d59',
  },
};

describe('the stock vault config', () => {
  it('lists the eight deployed vaults, keyed by their lowercase tickers', () => {
    expect(STOCK_VAULTS.map(stock => stock.ticker)).toEqual(Object.keys(DEPLOYED));
    for (const stock of STOCK_VAULTS) {
      // The backend keys each vault's APY by the same value.
      expect(stock.type).toBe(stock.ticker.toLowerCase());
      expect(Object.values(VaultType)).toContain(stock.type);
      expect(stock.vault).toBe(DEPLOYED[stock.ticker].vault);
      expect(stock.stockToken.address).toBe(DEPLOYED[stock.ticker].stock);
      expect(stock.shareSymbol).toBe(`so${stock.ticker}`);
      expect(stock.stockToken.symbol).toBe(`${stock.ticker}c`);
      expect(stock.shareDecimals).toBe(8);
      expect(stock.stockToken.decimals).toBe(8);
    }
  });

  it('names the companies behind the stock tokens', () => {
    expect(getStockVault(VaultType.AAPL)?.stockToken.name).toBe('Apple Inc.');
    expect(getStockVault(VaultType.SPCX)?.stockToken.name).toBe(
      'Space Exploration Technologies Corp.',
    );
  });

  // viem refuses to encode a mixed-case address whose checksum is wrong, so a typo here
  // would only show as a deposit that cannot be sent.
  it('holds checksummed addresses, none of them shared between vaults', () => {
    const addresses = STOCK_VAULTS.flatMap(stock => [
      stock.vault,
      stock.teller,
      stock.accountant,
      stock.boringQueue,
      stock.stockToken.address,
    ]);
    for (const address of addresses) expect(getAddress(address)).toBe(address);
    expect(new Set(addresses.map(address => address.toLowerCase())).size).toBe(addresses.length);
  });

  it('finds a vault by its share, its stock token or its type, in any casing', () => {
    const aapl = getStockVault(VaultType.AAPL);
    expect(getStockVaultByShareSymbol('SOAAPL')).toBe(aapl);
    expect(getStockVaultByStockSymbol('aaplc')).toBe(aapl);
    expect(getStockVaultByShareAddress(DEPLOYED.AAPL.vault.toLowerCase())).toBe(aapl);
    expect(getStockVaultByShareSymbol('soEURC')).toBeUndefined();
    expect(getStockVaultByShareSymbol(undefined)).toBeUndefined();
    expect(isStockVaultType(VaultType.NVDA)).toBe(true);
    expect(isStockVaultType(VaultType.EUR)).toBe(false);
    expect(isStockVaultType(undefined)).toBe(false);
  });
});

describe('the stock vaults in VAULTS', () => {
  // useSavingStore persists the selected vault as an index into VAULTS.
  it('come after every earlier vault, so a persisted index keeps its vault', () => {
    expect(VAULTS.slice(0, 4).map(vault => vault.type)).toEqual([
      VaultType.USDC,
      VaultType.FUSE,
      VaultType.ETH,
      VaultType.EUR,
    ]);
    expect(VAULTS.slice(4).map(vault => vault.type)).toEqual(STOCK_VAULT_TYPES);
  });

  it('are named for the stock they hold and take only it, on Base, from the Solid wallet', () => {
    const aapl = VAULTS.find(vault => vault.type === VaultType.AAPL)!;
    expect(aapl).toMatchObject({
      name: 'AAPL',
      vaultName: 'AAPL Yield',
      vaultToken: 'soAAPL',
      decimals: 8,
      minimumAmount: STOCK_VAULT_MINIMUM_DEPOSIT,
      vaults: [{ address: DEPLOYED.AAPL.vault, chainId: base.id }],
      depositConfig: {
        methods: ['wallet'],
        supportedChains: [base.id],
        supportedTokens: ['AAPLc'],
      },
    });
    expect(aapl.isComingSoon).toBeFalsy();
    expect(getAllowedTokensForChain(base.id, aapl)).toEqual(['AAPLc']);
    expect(getDefaultDepositSelection(aapl)).toEqual({ chainId: base.id, principalToken: 'AAPLc' });
  });

  // A stock token is offered to its own vault and nowhere else.
  it('never offers a stock token to another vault', () => {
    const usd = VAULTS.find(vault => vault.type === VaultType.USDC)!;
    const nvda = VAULTS.find(vault => vault.type === VaultType.NVDA)!;
    expect(getAllowedTokensForChain(base.id, usd)).not.toContain('AAPLc');
    expect(getAllowedTokensForChain(base.id, nvda)).toEqual(['NVDAc']);
    expect(getAllowedTokensForChain(base.id)).not.toContain('AAPLc');
  });
});

describe('stock vault withdrawals', () => {
  it('recognises each share as its own vault, keyed by its ticker', () => {
    for (const stock of STOCK_VAULTS) {
      expect(isSolidTokenSymbol(stock.shareSymbol)).toBe(true);
      expect(getVaultKey(stock.shareSymbol.toUpperCase())).toBe(stock.ticker);
    }
    // The stock token is what the vault pays out, not a position to withdraw from.
    expect(isSolidTokenSymbol('AAPLc')).toBe(false);
    expect(getVaultKey('AAPLc')).toBeNull();
  });

  it('withdraws a share to its stock token on Base in one step', () => {
    expect(VAULT_META.TSLA).toEqual({
      key: 'TSLA',
      displayName: 'soTSLA',
      iconSymbol: 'soTSLA',
      destinationSymbol: 'TSLAc',
      destinationNetwork: 'Base',
      requiresBridge: false,
    });
  });
});
