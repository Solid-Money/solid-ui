import { base, fuse } from 'viem/chains';

import { buildSpendableAssetRows } from '@/components/Card/NewCardDetails/SpendMode/useSpendableAssetRows';
import { USDC_STARGATE, USDT_STARGATE } from '@/constants/addresses';
import { baseSpendableAssets, CARD_SPENDABLE_ASSETS } from '@/constants/cardSpendableAssets';
import { ADDRESSES } from '@/lib/config';
import { TokenBalance, TokenType } from '@/lib/types';

jest.mock('@/hooks/useBalances', () => ({ useBalances: jest.fn() }));
jest.mock('@/hooks/useCardSpendableBalance', () => ({ useCardSpendableAssets: jest.fn() }));
jest.mock('@/hooks/useVaultExchangeRate', () => ({ useVaultExchangeRate: jest.fn() }));

const EURC = '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42';

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
});
