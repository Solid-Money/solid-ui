import { base, fuse } from 'viem/chains';

import { buildSpendableAssetRows } from '@/components/Card/NewCardDetails/SpendMode/useSpendableAssetRows';
import { USDC_STARGATE, USDT_STARGATE } from '@/constants/addresses';
import { baseSpendableAssets, CARD_SPENDABLE_ASSETS } from '@/constants/cardSpendableAssets';
import { ADDRESSES } from '@/lib/config';
import { TokenBalance, TokenType } from '@/lib/types';

jest.mock('@/hooks/useBalances', () => ({ useBalances: jest.fn() }));
jest.mock('@/hooks/useCardSpendableBalance', () => ({ useCardSpendableAssets: jest.fn() }));
jest.mock('@/hooks/useVaultExchangeRate', () => ({ useVaultExchangeRate: jest.fn() }));
jest.mock('@/hooks/useMainCurrency', () => ({ useMainCurrency: jest.fn() }));

const EURC = '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
const CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';
const SOL = '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82';
const AAVE = '0x63706e401c06ac8513145b7687A14804d17f814b';
const CBZEC = '0xB2000000000000000000008501b13360000cb2EC';

const token = (overrides: Partial<TokenBalance>): TokenBalance => ({
  contractTickerSymbol: 'USDC',
  contractName: 'USD Coin',
  contractAddress: USDC_STARGATE,
  balance: '0',
  contractDecimals: 6,
  quoteRate: 1,
  type: TokenType.ERC20,
  chainId: fuse.id,
  ...overrides,
});

/** The Figma 29120:9364 holdings: $100 USDC, $40 USDT, 18.47 soUSD, €74.20 EURC. */
const HOLDINGS: TokenBalance[] = [
  token({ balance: '100000000' }),
  token({ contractTickerSymbol: 'USDT', contractAddress: USDT_STARGATE, balance: '40000000' }),
  token({
    contractTickerSymbol: 'soUSD',
    contractAddress: ADDRESSES.fuse.vault,
    balance: '18470000',
    quoteRate: 1.0828,
  }),
  token({
    contractTickerSymbol: 'EURC',
    contractAddress: EURC,
    balance: '74200000',
    quoteRate: 1.1658,
    chainId: base.id,
  }),
];

describe('buildSpendableAssetRows', () => {
  it('lists the Fuse stablecoins and soUSD, with the shares under soUSD', () => {
    const { rows, totalUsd, dollarUsd } = buildSpendableAssetRows(
      HOLDINGS,
      CARD_SPENDABLE_ASSETS,
      undefined,
    );

    expect(rows.map(row => [row.name, row.subtitle, row.value, row.detail])).toEqual([
      ['USDC', undefined, '$100.00', undefined],
      ['USDT', undefined, '$40.00', undefined],
      ['soUSD', 'USD Yield', '$20.00', '18.47 soUSD'],
    ]);
    // EURC is held but euro spending is off, so it is not spendable and not counted.
    expect(totalUsd).toBeCloseTo(160, 1);
    expect(dollarUsd).toBeCloseTo(160, 1);
  });

  it('adds EURC in euros, at its dollar value in the balance but not in what Cash spends', () => {
    const { rows, totalUsd, dollarUsd } = buildSpendableAssetRows(
      HOLDINGS,
      [...CARD_SPENDABLE_ASSETS, ...baseSpendableAssets([EURC])],
      undefined,
    );

    expect(rows.at(-1)).toMatchObject({
      name: 'EURC',
      subtitle: 'Euro purchases',
      value: '€74.20',
      detail: '≈ $86.50',
      isDollar: false,
    });
    expect(totalUsd).toBeCloseTo(246.5, 1);
    expect(dollarUsd).toBeCloseTo(160, 1);
  });

  it('values soEUR at its vault rate in euros, and in dollars through the EURC quote', () => {
    const { rows } = buildSpendableAssetRows(
      [
        ...HOLDINGS,
        token({
          contractTickerSymbol: 'soEUR',
          contractAddress: ADDRESSES.base.soEurcVault,
          balance: '10000000',
          quoteRate: 0,
          chainId: base.id,
        }),
      ],
      [...CARD_SPENDABLE_ASSETS, ...baseSpendableAssets([EURC, ADDRESSES.base.soEurcVault])],
      1.02,
    );

    const soEur = rows.find(row => row.name === 'soEUR');
    expect(soEur).toMatchObject({ value: '€10.20', detail: '10.00 soEUR', subtitle: 'EUR Yield' });
    expect(soEur?.usd).toBeCloseTo(10.2 * 1.1658, 4);
  });

  it('values soEUR through the card euro rate when the Safe holds no EURC', () => {
    const soUsd = HOLDINGS[2];
    const { rows, totalUsd, dollarUsd } = buildSpendableAssetRows(
      [
        soUsd,
        token({
          contractTickerSymbol: 'soEUR',
          contractAddress: ADDRESSES.base.soEurcVault,
          balance: '10000000',
          quoteRate: 0,
          chainId: base.id,
        }),
      ],
      [...CARD_SPENDABLE_ASSETS, ...baseSpendableAssets([EURC, ADDRESSES.base.soEurcVault])],
      1.017,
      1.125,
    );

    expect(rows.find(row => row.name === 'soEUR')?.usd).toBeCloseTo(10.17 * 1.125, 4);
    // The balance counts both vaults; Cash, which pays dollar purchases, still counts soUSD alone.
    expect(totalUsd).toBeCloseTo(18.47 * 1.0828 + 10.17 * 1.125, 4);
    expect(dollarUsd).toBeCloseTo(18.47 * 1.0828, 4);
  });

  it('leaves out an asset the Safe does not hold', () => {
    const { rows } = buildSpendableAssetRows([HOLDINGS[0]], CARD_SPENDABLE_ASSETS, undefined);

    expect(rows.map(row => row.name)).toEqual(['USDC']);
  });

  it('lists nothing before the balances load', () => {
    expect(buildSpendableAssetRows(undefined, CARD_SPENDABLE_ASSETS, undefined)).toEqual({
      rows: [],
      totalUsd: 0,
      dollarUsd: 0,
    });
  });

  /**
   * The Base instance's list holds dollars and crypto as well as euros. Every address used to
   * be filed under EURC, which would have called USDC, USDT and the collateral "EURC for euro
   * purchases".
   */
  describe('the Base spend tokens', () => {
    it("names each by its own address, in the backend's draw order", () => {
      const assets = baseSpendableAssets([
        BASE_USDC,
        BASE_USDT,
        EURC,
        ADDRESSES.base.soEurcVault,
        CBBTC,
        SOL,
        AAVE,
        CBZEC,
      ]);

      expect(assets.map(asset => [asset.symbol, asset.qualifier])).toEqual([
        ['USDC', undefined],
        ['USDT', undefined],
        ['EURC', 'for euro purchases'],
        ['soEUR', 'for euro purchases'],
        ['cbBTC', undefined],
        ['SOL', undefined],
        ['AAVE', undefined],
        ['cbZEC', undefined],
      ]);
      expect(assets.every(asset => asset.chainIds?.[0] === base.id)).toBe(true);
    });

    it('leaves out an address this build cannot name rather than calling it EURC', () => {
      expect(baseSpendableAssets(['0x000000000000000000000000000000000000dEaD', EURC])).toEqual([
        expect.objectContaining({ symbol: 'EURC' }),
      ]);
    });

    it('lists Base USDC as a dollar row and Bitcoin by name, in dollars, with its amount', () => {
      const { rows, dollarUsd } = buildSpendableAssetRows(
        [
          token({ contractAddress: BASE_USDC, balance: '25000000', chainId: base.id }),
          token({
            contractTickerSymbol: 'cbBTC',
            contractAddress: CBBTC,
            balance: '120000',
            contractDecimals: 8,
            quoteRate: 80_000,
            chainId: base.id,
          }),
        ],
        baseSpendableAssets([BASE_USDC, CBBTC]),
        undefined,
      );

      expect(rows.map(row => [row.icon, row.name, row.subtitle, row.value, row.detail])).toEqual([
        ['usdc', 'USDC', undefined, '$25.00', undefined],
        ['cbbtc', 'cbBTC', 'Bitcoin', '$960.00', '0.0012 cbBTC'],
      ]);
      // Bitcoin counts in the balance, not as dollars.
      expect(dollarUsd).toBeCloseTo(25, 4);
    });
  });
});
