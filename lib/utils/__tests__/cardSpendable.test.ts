import { fuse, mainnet } from 'viem/chains';

import { CARD_SPENDABLE_ASSETS, CardSpendableAsset } from '@/constants/cardSpendableAssets';
import { TokenBalance, TokenType } from '@/lib/types';
import { sumCardSpendableUSD } from '@/lib/utils/cardSpendable';

const token = (overrides: Partial<TokenBalance>): TokenBalance => ({
  contractTickerSymbol: 'soUSD',
  contractName: 'Solid USD',
  contractAddress: '0x0000000000000000000000000000000000000001',
  balance: '1000000', // 1 token at 6 decimals
  contractDecimals: 6,
  quoteRate: 1.08,
  type: TokenType.ERC20,
  chainId: fuse.id,
  ...overrides,
});

describe('sumCardSpendableUSD', () => {
  it('values a configured holding at its USD rate', () => {
    expect(
      sumCardSpendableUSD([token({ balance: '100000000' })], CARD_SPENDABLE_ASSETS),
    ).toBeCloseTo(108, 6);
  });

  it('ignores an asset the card cannot spend', () => {
    const tokens = [token({}), token({ contractTickerSymbol: 'USDC', quoteRate: 1 })];

    // Only soUSD is configured today, so the USDC sitting beside it is not
    // spending power — the row must not promise what the card cannot settle from.
    expect(sumCardSpendableUSD(tokens, CARD_SPENDABLE_ASSETS)).toBeCloseTo(1.08, 6);
  });

  it('ignores the same asset on a chain the card cannot reach', () => {
    // soUSD is pulled from the Safe on Fuse; the Ethereum holding is unreachable.
    const tokens = [token({ chainId: mainnet.id })];

    expect(sumCardSpendableUSD(tokens, CARD_SPENDABLE_ASSETS)).toBe(0);
  });

  it('counts every chain when an entry names none', () => {
    const anyChain: CardSpendableAsset[] = [{ symbol: 'soUSD' }];
    const tokens = [token({}), token({ chainId: mainnet.id })];

    expect(sumCardSpendableUSD(tokens, anyChain)).toBeCloseTo(2.16, 6);
  });

  it('matches tickers case-insensitively', () => {
    expect(
      sumCardSpendableUSD([token({ contractTickerSymbol: 'SOUSD' })], CARD_SPENDABLE_ASSETS),
    ).toBeCloseTo(1.08, 6);
  });

  // The hazard of a config that grows: a bare entry and a chain-scoped one for the
  // same asset both match one holding, and a naive sum would count it twice.
  it('counts a holding once however many entries match it', () => {
    const overlapping: CardSpendableAsset[] = [
      { symbol: 'soUSD' },
      { symbol: 'soUSD', chainIds: [fuse.id] },
    ];

    expect(sumCardSpendableUSD([token({})], overlapping)).toBeCloseTo(1.08, 6);
  });

  it('skips an unpriced holding instead of poisoning the total with NaN', () => {
    const tokens = [token({ quoteRate: undefined }), token({})];

    expect(sumCardSpendableUSD(tokens, CARD_SPENDABLE_ASSETS)).toBeCloseTo(1.08, 6);
  });

  it('is zero before balances have loaded', () => {
    expect(sumCardSpendableUSD(undefined, CARD_SPENDABLE_ASSETS)).toBe(0);
    expect(sumCardSpendableUSD([], CARD_SPENDABLE_ASSETS)).toBe(0);
  });

  it('adds a newly configured asset with no other change', () => {
    // What extending CARD_SPENDABLE_ASSETS is meant to do: the sum follows the
    // config, so a future stablecoin or yield asset is a one-line addition.
    const extended: CardSpendableAsset[] = [
      ...CARD_SPENDABLE_ASSETS,
      { symbol: 'USDC', chainIds: [fuse.id] },
    ];
    const tokens = [token({}), token({ contractTickerSymbol: 'USDC', quoteRate: 1 })];

    expect(sumCardSpendableUSD(tokens, extended)).toBeCloseTo(2.08, 6);
  });
});
