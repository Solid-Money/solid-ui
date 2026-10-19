import { combineCreditFigures } from '@/components/Card/NewCardDetails/SpendMode/useCreditModeFigures';

import type {
  CardCreditPositions,
  CreditCollateralAsset,
  CreditInstancePosition,
} from '@/hooks/useCardCreditPositions';

jest.mock('@/hooks/useCardCreditPositions', () => ({ useCardCreditPositions: jest.fn() }));
jest.mock('@/hooks/useCardSpendRegistration', () => ({ useCardSpendRegistration: jest.fn() }));

const RATE = 1_243_680_656n;
const SOUSD = '0x75333830E7014e909535389a6E5b0C02aA62ca27';
const SOEUR = '0x4f4B212aF8B5020399dde325e1Bc5B33b53DB70B';

const asset = (overrides: Partial<CreditCollateralAsset>): CreditCollateralAsset => ({
  chainId: 122,
  token: SOUSD,
  symbol: 'soUSD',
  amount: 0n,
  valueUsd: 0n,
  priceUsable: true,
  ...overrides,
});

const instance = (overrides: Partial<CreditInstancePosition>): CreditInstancePosition => ({
  chainId: 122,
  debtUsd: 0n,
  creditLineUsd: 0n,
  creditHeadroomUsd: 0n,
  borrowApyPerSecond: RATE,
  collateral: [],
  ...overrides,
});

const fusePosition = {
  debtUsd: 800_000n,
  borrowingPowerUsd: 100_000_000n,
  prospectivePowerUsd: 76_500_000n,
  creditHeadroomUsd: 175_700_000n,
};

describe('combineCreditFigures', () => {
  it('shows Fuse alone, with its soUSD row, for a Safe not live on Base', () => {
    const positions: CardCreditPositions = {
      fuse: instance({ collateral: [asset({ valueUsd: 230_000_000n })] }),
      base: null,
    };

    expect(combineCreditFigures(fusePosition, RATE, positions)).toEqual({
      borrowed: '$0.80',
      creditLimit: '$176.50',
      borrowApy: '4.00%',
      borrowedProgress: 0.0045,
      availableToBorrow: '$175.70',
      collateral: [
        {
          key: `122:${SOUSD}`,
          label: 'USD Yield',
          icon: 'usd',
          value: '$230.00',
          usdEquivalent: undefined,
        },
      ],
    });
  });

  it('adds Base to the line, the debt and the headroom, and lists soEUR in euros', () => {
    const positions: CardCreditPositions = {
      fuse: instance({ collateral: [asset({ valueUsd: 230_000_000n })] }),
      base: instance({
        chainId: 8453,
        debtUsd: 200_000n,
        creditLineUsd: 70_000_000n,
        creditHeadroomUsd: 69_800_000n,
        collateral: [
          asset({
            chainId: 8453,
            token: SOEUR,
            symbol: 'soEUR',
            valueUsd: 81_600_000n,
            valueEur: 70_000_000n,
          }),
        ],
      }),
    };

    const figures = combineCreditFigures(fusePosition, RATE, positions);

    expect(figures.borrowed).toBe('$1');
    expect(figures.creditLimit).toBe('$246.50');
    expect(figures.availableToBorrow).toBe('$245.50');
    expect(
      figures.collateral.map(row => [row.label, row.icon, row.value, row.usdEquivalent]),
    ).toEqual([
      ['USD Yield', 'usd', '$230.00', undefined],
      ['EUR Yield', 'eur', '€70.00', '≈ $81.60'],
    ]);
  });

  it('keeps the Fuse figures while the per-asset read has not answered', () => {
    const figures = combineCreditFigures(fusePosition, RATE, undefined);

    expect(figures.creditLimit).toBe('$176.50');
    expect(figures.collateral).toEqual([]);
  });

  it('reads as an empty line for a Safe with no v2 position', () => {
    const figures = combineCreditFigures(null, 0n, { fuse: null, base: null });

    expect(figures).toMatchObject({
      borrowed: '$0',
      creditLimit: '$0',
      borrowedProgress: 0,
      availableToBorrow: '$0',
      collateral: [],
    });
  });

  it('shows a euro asset in dollars when the instance cannot price EURC', () => {
    const figures = combineCreditFigures(fusePosition, RATE, {
      fuse: null,
      base: instance({
        chainId: 8453,
        collateral: [
          asset({ chainId: 8453, token: SOEUR, symbol: 'soEUR', valueUsd: 81_600_000n }),
        ],
      }),
    });

    expect(figures.collateral[0]).toMatchObject({
      label: 'EUR Yield',
      icon: 'eur',
      value: '$81.60',
    });
    expect(figures.collateral[0].usdEquivalent).toBeUndefined();
  });
});
