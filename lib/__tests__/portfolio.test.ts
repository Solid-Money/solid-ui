import { parseUnits } from 'viem';

import { ADDRESSES } from '@/lib/config';
import {
  bridgedShareValues,
  cashValue,
  coinAssetPath,
  groupPortfolioCash,
  portfolioTotals,
  savingsUsdValue,
  splitSmallBalances,
  sumPortfolioValues,
} from '@/lib/portfolio';
import { TokenBalance, TokenType, VaultType } from '@/lib/types';

const token = (overrides: Partial<TokenBalance> = {}): TokenBalance => ({
  chainId: 1,
  contractAddress: '0x1111111111111111111111111111111111111111',
  contractTickerSymbol: 'USDC',
  contractName: 'USD Coin',
  contractDecimals: 6,
  balance: '100000000',
  quoteRate: 1,
  type: TokenType.ERC20,
  commonId: 'usd-coin',
  ...overrides,
});

describe('portfolio amounts', () => {
  it('values yield-bearing shares through both the share rate and underlying USD price', () => {
    expect(savingsUsdValue(10_000, 1.08, 0.012)).toBeCloseTo(129.6);
    expect(savingsUsdValue(0.05, 1.1, 4000)).toBeCloseTo(220);
  });
  it.each([undefined, 0, -1, NaN, Infinity])(
    'leaves a funded position unpriced when its rate is %s',
    rate => {
      expect(savingsUsdValue(100, rate)).toBeUndefined();
    },
  );
  it('distinguishes confirmed zero shares from an unavailable balance or price', () => {
    expect(savingsUsdValue(0, undefined)).toBe(0);
    expect(savingsUsdValue(undefined, 1)).toBeUndefined();
    expect(savingsUsdValue(100, 1, 0)).toBeUndefined();
    expect(sumPortfolioValues([100, undefined])).toBeUndefined();
  });
  it('reconciles gross assets and subtracts debt once for net balance', () => {
    const result = portfolioTotals({ earn: 2870, locked: 120, cash: 228.4, card: 0, debt: 350 });
    expect(result.totalAssets).toBeCloseTo(3218.4);
    expect(result.netBalance).toBeCloseTo(2868.4);
  });
  it('keeps the known parts and marks the total incomplete instead of counting a gap as zero', () => {
    const missingCard = portfolioTotals({
      earn: 100,
      locked: 0,
      cash: 20,
      card: undefined,
      debt: 0,
    });
    expect(missingCard.totalAssets).toBe(120);
    expect(missingCard.isComplete).toBe(false);
    const missingDebt = portfolioTotals({
      earn: 100,
      locked: 0,
      cash: 20,
      card: 0,
      debt: undefined,
    });
    expect(missingDebt.netBalance).toBe(120);
    expect(missingDebt.isComplete).toBe(false);
    expect(portfolioTotals({ earn: 100, locked: 0, cash: 20, card: 0, debt: 0 }).isComplete).toBe(
      true,
    );
  });
  it('carries a partial part through as an incomplete total', () => {
    expect(
      portfolioTotals({ earn: 1, locked: 0, cash: 1, card: 0, debt: 0, complete: false })
        .isComplete,
    ).toBe(false);
  });
  it('has no total at all only when nothing is known', () => {
    expect(
      portfolioTotals({
        earn: undefined,
        locked: undefined,
        cash: undefined,
        card: undefined,
        debt: undefined,
      }).totalAssets,
    ).toBeUndefined();
  });
  it('allows negative net worth rather than clamping outstanding debt away', () => {
    expect(portfolioTotals({ earn: 50, locked: 0, cash: 0, card: 0, debt: 70 }).netBalance).toBe(
      -20,
    );
  });
});

describe('asset grouping and navigation', () => {
  it('normalizes each network balance using its own decimals and sums each network valuation', () => {
    const groups = groupPortfolioCash([
      token({ balance: parseUnits('180', 6).toString(), quoteRate: 1 }),
      token({
        chainId: 56,
        contractDecimals: 18,
        balance: parseUnits('2.5', 18).toString(),
        quoteRate: 0.99,
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].balance).toBeCloseTo(182.5);
    expect(groups[0].valueUsd).toBeCloseTo(182.475);
    expect(groups[0].networkCount).toBe(2);
  });
  it('keeps unrelated tokens with the same ticker separate without a curated commonId', () => {
    expect(
      groupPortfolioCash([
        token({ commonId: undefined }),
        token({ commonId: undefined, chainId: 8453 }),
      ]),
    ).toHaveLength(2);
  });
  it('keeps vault shares out of Cash even when they share an underlying commonId', () => {
    const groups = groupPortfolioCash([
      token(),
      token({ chainId: 122, contractAddress: ADDRESSES.fuse.vault, contractTickerSymbol: 'soUSD' }),
      token({
        chainId: 122,
        contractAddress: ADDRESSES.fuse.fuseVault,
        contractTickerSymbol: 'soFUSE',
      }),
      token({ contractAddress: ADDRESSES.ethereum.soEthVault, contractTickerSymbol: 'soETH' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].valueUsd).toBe(100);
  });
  it('keeps a vault share bridged to another network out of Cash and values it as Earn', () => {
    // soUSD on Base and Arbitrum carries the Ethereum vault's address.
    const bridgedSoUsd = token({
      chainId: 8453,
      contractAddress: ADDRESSES.ethereum.vault,
      contractTickerSymbol: 'soUSD',
      balance: '24774869',
      quoteRate: 1.085,
      commonId: undefined,
    });
    expect(groupPortfolioCash([bridgedSoUsd, token()])).toHaveLength(1);
    expect(bridgedShareValues([bridgedSoUsd])[VaultType.USDC]).toBeCloseTo(26.88, 2);
  });
  it('leaves shares on the savings networks to the savings read, so nothing counts twice', () => {
    const ethereumSoUsd = token({ chainId: 1, contractAddress: ADDRESSES.ethereum.vault });
    const fuseSoUsd = token({ chainId: 122, contractAddress: ADDRESSES.fuse.vault });
    expect(groupPortfolioCash([ethereumSoUsd, fuseSoUsd])).toHaveLength(0);
    expect(bridgedShareValues([ethereumSoUsd, fuseSoUsd])).toEqual({});
  });
  it('marks a bridged share unavailable rather than zero when it has no rate', () => {
    const unpriced = token({
      chainId: 42161,
      contractAddress: ADDRESSES.ethereum.vault,
      quoteRate: 0,
    });
    const values = bridgedShareValues([unpriced]);
    expect(VaultType.USDC in values).toBe(true);
    expect(values[VaultType.USDC]).toBeUndefined();
  });
  it('includes escrowed cash once and distinguishes an escrow-only holding', () => {
    const [mixed] = groupPortfolioCash([token()], [token({ balance: '50000000' })]);
    expect(mixed.valueUsd).toBe(150);
    expect(mixed.networkCount).toBe(1);
    expect(mixed.heldInWallet).toBe(true);
    expect(mixed.backsCredit).toBe(true);
    expect(groupPortfolioCash([], [token()])[0].heldInWallet).toBe(false);
  });
  it('shows unpriced holdings without letting them blank the Cash total', () => {
    // Airdropped or unlisted tokens can reach the wallet with no price from any source.
    const groups = groupPortfolioCash([
      token({ balance: '400000' }),
      token({
        balance: '20000000',
        contractAddress: '0x3333333333333333333333333333333333333333',
        commonId: 'other',
      }),
      token({
        contractAddress: '0x2222222222222222222222222222222222222222',
        commonId: 'unknown',
        quoteRate: 0,
      }),
    ]);
    const { visible, small } = splitSmallBalances(groups);
    expect(visible.some(asset => asset.valueUsd === undefined)).toBe(true);
    expect(small[0].valueUsd).toBeCloseTo(0.4);
    expect(cashValue(groups)).toEqual({ total: expect.closeTo(20.4), unpricedCount: 1 });
  });
  it('routes native tokens through the coin page zero address', () => {
    expect(
      coinAssetPath(token({ type: TokenType.NATIVE, chainId: 122, contractAddress: 'native' })),
    ).toBe('/coins/122-0x0000000000000000000000000000000000000000');
  });
});
