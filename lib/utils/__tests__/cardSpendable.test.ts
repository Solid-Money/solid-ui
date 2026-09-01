import { fuse, mainnet } from 'viem/chains';

import { USDC, USDC_STARGATE, USDT_STARGATE } from '@/constants/addresses';
import { CARD_SPENDABLE_ASSETS, CardSpendableAsset } from '@/constants/cardSpendableAssets';
import { ADDRESSES } from '@/lib/config';
import { TokenBalance, TokenType } from '@/lib/types';
import { sumCardSpendableUSD } from '@/lib/utils/cardSpendable';

const SOUSD = ADDRESSES.fuse.vault;

const token = (overrides: Partial<TokenBalance>): TokenBalance => ({
  contractTickerSymbol: 'soUSD',
  contractName: 'Solid USD',
  contractAddress: SOUSD,
  balance: '1000000', // 1 token at 6 decimals
  contractDecimals: 6,
  quoteRate: 1.08,
  type: TokenType.ERC20,
  chainId: fuse.id,
  ...overrides,
});

const usdc = (overrides: Partial<TokenBalance> = {}): TokenBalance =>
  token({
    contractTickerSymbol: 'USDC',
    contractName: 'USD Coin',
    contractAddress: USDC_STARGATE,
    quoteRate: 1,
    ...overrides,
  });

const usdt = (overrides: Partial<TokenBalance> = {}): TokenBalance =>
  token({
    contractTickerSymbol: 'USDT',
    contractName: 'Tether USD',
    contractAddress: USDT_STARGATE,
    quoteRate: 1,
    ...overrides,
  });

describe('sumCardSpendableUSD', () => {
  it('values a configured holding at its USD rate', () => {
    expect(
      sumCardSpendableUSD([token({ balance: '100000000' })], CARD_SPENDABLE_ASSETS),
    ).toBeCloseTo(108, 6);
  });

  it('adds up every asset the card settles from', () => {
    // USDC, USDT and soUSD are all drawn from at settlement, so all three are
    // spending power — the row would understate the card if it named only one.
    expect(sumCardSpendableUSD([token({}), usdc(), usdt()], CARD_SPENDABLE_ASSETS)).toBeCloseTo(
      3.08,
      6,
    );
  });

  it('ignores an asset the card cannot spend', () => {
    const tokens = [
      token({}),
      token({
        contractTickerSymbol: 'WFUSE',
        contractAddress: '0x0000000000000000000000000000000000000001',
        quoteRate: 0.02,
      }),
    ];

    expect(sumCardSpendableUSD(tokens, CARD_SPENDABLE_ASSETS)).toBeCloseTo(1.08, 6);
  });

  /**
   * The reason the config carries addresses at all.
   *
   * Fuse has several contracts per stablecoin ticker, and `SolidCashModule` allowlists
   * exactly one of each. A ticker-only match would count a legacy USDC balance as
   * spending power — the user would see a figure the card then declines against, with
   * nothing on screen explaining why.
   */
  it('ignores a same-ticker holding at an address the card cannot reach', () => {
    const legacy = usdc({ contractAddress: USDC });

    expect(sumCardSpendableUSD([legacy], CARD_SPENDABLE_ASSETS)).toBe(0);
    expect(sumCardSpendableUSD([legacy, usdc()], CARD_SPENDABLE_ASSETS)).toBeCloseTo(1, 6);
  });

  it('matches addresses case-insensitively', () => {
    expect(
      sumCardSpendableUSD(
        [usdc({ contractAddress: USDC_STARGATE.toUpperCase() })],
        CARD_SPENDABLE_ASSETS,
      ),
    ).toBeCloseTo(1, 6);
  });

  /**
   * The other half of why addresses are decisive.
   *
   * The ticker in wallet balances is whatever the indexer reports — Blockscout calls
   * this contract `USDC.E`, and it only reads as "USDC" because `useBalances` carries a
   * normalisation keyed on that exact casing. If that ever stops matching, the asset
   * must still count: a silently *missing* asset is the harder failure to notice,
   * because nothing on screen looks broken.
   */
  it('counts a configured address whatever ticker the indexer reports', () => {
    const oddTicker = usdc({ contractTickerSymbol: 'USDC.e' });

    expect(sumCardSpendableUSD([oddTicker], CARD_SPENDABLE_ASSETS)).toBeCloseTo(1, 6);
  });

  it('ignores the same asset on a chain the card cannot reach', () => {
    // The Safe is debited on Fuse; an Ethereum holding is unreachable.
    const tokens = [token({ chainId: mainnet.id })];

    expect(sumCardSpendableUSD(tokens, CARD_SPENDABLE_ASSETS)).toBe(0);
  });

  it('counts every chain and every address when an entry constrains neither', () => {
    const anyChain: CardSpendableAsset[] = [{ symbol: 'soUSD' }];
    const tokens = [token({}), token({ chainId: mainnet.id })];

    expect(sumCardSpendableUSD(tokens, anyChain)).toBeCloseTo(2.16, 6);
  });

  it('matches tickers case-insensitively on an entry with no address', () => {
    const anyAddress: CardSpendableAsset[] = [{ symbol: 'soUSD', chainIds: [fuse.id] }];

    expect(sumCardSpendableUSD([token({ contractTickerSymbol: 'SOUSD' })], anyAddress)).toBeCloseTo(
      1.08,
      6,
    );
  });

  // The hazard of a config that grows: a bare entry and a chain-scoped one for the
  // same asset both match one holding, and a naive sum would count it twice.
  it('counts a holding once however many entries match it', () => {
    const overlapping: CardSpendableAsset[] = [
      { symbol: 'soUSD' },
      { symbol: 'soUSD', chainIds: [fuse.id] },
      { symbol: 'soUSD', chainIds: [fuse.id], addresses: [SOUSD.toLowerCase()] },
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
    // What extending CARD_SPENDABLE_ASSETS is meant to do: the sum follows the config,
    // so onboarding another asset on-chain is a one-line addition here.
    const extended: CardSpendableAsset[] = [
      ...CARD_SPENDABLE_ASSETS,
      { symbol: 'WFUSE', chainIds: [fuse.id] },
    ];
    const tokens = [token({}), token({ contractTickerSymbol: 'WFUSE', quoteRate: 1 })];

    expect(sumCardSpendableUSD(tokens, extended)).toBeCloseTo(2.08, 6);
  });
});
