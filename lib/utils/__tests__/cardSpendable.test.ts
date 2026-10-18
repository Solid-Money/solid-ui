import { base, fuse, mainnet } from 'viem/chains';

import { USDC, USDC_STARGATE, USDT_STARGATE } from '@/constants/addresses';
import { CARD_SPENDABLE_ASSETS, CardSpendableAsset } from '@/constants/cardSpendableAssets';
import { ADDRESSES } from '@/lib/config';
import { CardSpendDeployment, TokenBalance, TokenType } from '@/lib/types';
import {
  baseEurcHeld,
  cardSpendableAssetsFor,
  sumCardSpendableUSD,
} from '@/lib/utils/cardSpendable';

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

/**
 * Which assets count, by what the user has enabled.
 *
 * EURC on Base is spending power only once the Base instance is enabled — before that the card
 * declines against it — so the list follows the backend's deployment record.
 */
describe('cardSpendableAssetsFor', () => {
  const BASE_EURC = '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42';

  const baseDeployment = (overrides: Partial<CardSpendDeployment> = {}): CardSpendDeployment => ({
    chainId: base.id,
    name: 'Base',
    currency: 'USD',
    moduleAddress: '0x47a5e832e1178726dd13add762774a704878ad98',
    available: true,
    enabled: true,
    enabledAt: '2026-10-12T10:35:29.869Z',
    enableTxHash: null,
    safeAddress: '0x4987d26b6e5d767b8eec3ebd5056a5ae7bdce2aa',
    spendTokens: [BASE_EURC.toLowerCase()],
    ...overrides,
  });

  const eurc = (overrides: Partial<TokenBalance> = {}): TokenBalance =>
    token({
      contractTickerSymbol: 'EURC',
      contractName: 'EURC',
      contractAddress: BASE_EURC,
      balance: '250960000',
      quoteRate: 1.117427,
      chainId: base.id,
      ...overrides,
    });

  it('is the Fuse set before the deployment list has loaded', () => {
    expect(cardSpendableAssetsFor(undefined)).toBe(CARD_SPENDABLE_ASSETS);
  });

  it('is the Fuse set when Base has not been enabled', () => {
    expect(cardSpendableAssetsFor([baseDeployment({ enabled: false })])).toBe(
      CARD_SPENDABLE_ASSETS,
    );
  });

  it('is the Fuse set when the backend has switched Base off', () => {
    // `available: false` is CASH_BASE_ENABLED=false: nothing is routed to Base, so EURC there
    // would not pay for a purchase.
    expect(cardSpendableAssetsFor([baseDeployment({ available: false })])).toBe(
      CARD_SPENDABLE_ASSETS,
    );
  });

  it('counts EURC on Base once euro spending is enabled', () => {
    const assets = cardSpendableAssetsFor([baseDeployment()]);

    expect(sumCardSpendableUSD([token({}), eurc()], assets)).toBeCloseTo(1.08 + 280.429, 2);
  });

  it('matches EURC by the address the backend allowlists, not the ticker', () => {
    const assets = cardSpendableAssetsFor([baseDeployment()]);
    const lookalike = eurc({ contractAddress: '0x0000000000000000000000000000000000000002' });

    expect(sumCardSpendableUSD([lookalike], assets)).toBe(0);
  });

  it('counts no EURC when the backend allowlists none on Base', () => {
    // An empty list is the backend saying its Base instance spends nothing — QA has no EURC
    // address configured. Filling it from the build would count EURC the card cannot spend.
    const assets = cardSpendableAssetsFor([baseDeployment({ spendTokens: [] })]);

    expect(assets).toBe(CARD_SPENDABLE_ASSETS);
    expect(sumCardSpendableUSD([eurc()], assets)).toBe(0);
  });

  it('does not count EURC held on another chain', () => {
    const assets = cardSpendableAssetsFor([baseDeployment()]);

    expect(sumCardSpendableUSD([eurc({ chainId: mainnet.id })], assets)).toBe(0);
  });

  /** The EURC the "Turn on euro spending" banner and the declined receipt talk about. */
  describe('baseEurcHeld', () => {
    it('is the EURC on Base in euros, before euro spending is on', () => {
      const deployments = [baseDeployment({ enabled: false })];

      expect(baseEurcHeld([token({}), eurc()], deployments)).toBeCloseTo(250.96, 2);
    });

    it('ignores a lookalike and EURC on another chain', () => {
      const deployments = [baseDeployment({ enabled: false })];

      expect(
        baseEurcHeld(
          [
            eurc({ contractAddress: '0x0000000000000000000000000000000000000002' }),
            eurc({ chainId: mainnet.id }),
          ],
          deployments,
        ),
      ).toBe(0);
    });

    it('counts only the EURC on a Base allowlist that also holds dollars', () => {
      const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
      const deployments = [
        baseDeployment({ enabled: false, spendTokens: [BASE_EURC.toLowerCase(), BASE_USDC] }),
      ];
      const usdcOnBase = token({
        contractTickerSymbol: 'USDC',
        contractName: 'USD Coin',
        contractAddress: BASE_USDC,
        balance: '500000000',
        contractDecimals: 6,
        chainId: base.id,
      });

      expect(baseEurcHeld([usdcOnBase, eurc()], deployments)).toBeCloseTo(250.96, 2);
      expect(baseEurcHeld([usdcOnBase], deployments)).toBe(0);
    });

    it('is zero before the balances load', () => {
      expect(baseEurcHeld(undefined, [baseDeployment({ enabled: false })])).toBe(0);
    });
  });
});
