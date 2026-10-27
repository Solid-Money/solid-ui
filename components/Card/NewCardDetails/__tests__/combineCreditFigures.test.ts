import { combineCreditFigures } from '@/components/Card/NewCardDetails/SpendMode/useCreditModeFigures';

import type {
  CardCreditPositions,
  CreditCollateralAsset,
  CreditInstancePosition,
} from '@/hooks/useCardCreditPositions';

jest.mock('@/hooks/useCardCreditPositions', () => ({ useCardCreditPositions: jest.fn() }));
jest.mock('@/hooks/useCardSpendRegistration', () => ({ useCardSpendRegistration: jest.fn() }));
jest.mock('@/hooks/useMainCurrency', () => ({ useCardDisplayCurrency: jest.fn() }));

const RATE = 1_243_680_656n;
const SOUSD = '0x75333830E7014e909535389a6E5b0C02aA62ca27';
const SOEUR = '0x4f4B212aF8B5020399dde325e1Bc5B33b53DB70B';
const CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';
const SOL = '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82';
const BASE_MODULE = '0x47A5e832E1178726dd13AdD762774A704878AD98';
/** A position with no debt, as the module reports its health factor. */
const NO_DEBT_HF = 2n ** 256n - 1n;

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
  moduleAddress: BASE_MODULE,
  debtUsd: 0n,
  healthFactorWad: NO_DEBT_HF,
  fullyPriced: true,
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
  healthFactorWad: 200n * 10n ** 18n,
};

const noFuseDebt = { ...fusePosition, debtUsd: 0n, healthFactorWad: NO_DEBT_HF };

/** A Base position borrowed against cbBTC. */
const baseLoan = (overrides: Partial<CreditInstancePosition> = {}) =>
  instance({
    chainId: 8453,
    debtUsd: 50_000_000n,
    creditLineUsd: 400_000_000n,
    creditHeadroomUsd: 350_000_000n,
    healthFactorWad: 3n * 10n ** 18n,
    collateral: [
      asset({
        chainId: 8453,
        token: CBBTC,
        symbol: 'cbBTC',
        amount: 1_000_000n,
        valueUsd: 798_000_000n,
      }),
    ],
    ...overrides,
  });

describe('combineCreditFigures', () => {
  it('formats the line, the debt and the headroom with the main currency’s formatter', () => {
    const inEuros = (amount: bigint) => `€${(Number(amount) / 1_000_000 / 1.25).toFixed(2)}`;

    const figures = combineCreditFigures(fusePosition, RATE, undefined, inEuros);

    expect(figures.borrowed).toBe('€0.64');
    expect(figures.creditLimit).toBe('€141.20');
    expect(figures.availableToBorrow).toBe('€140.56');
  });

  it('shows Fuse alone, with its soUSD row, for a Safe not live on Base', () => {
    const positions: CardCreditPositions = {
      fuse: instance({ collateral: [asset({ amount: 213_000_000n, valueUsd: 230_000_000n })] }),
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
      hasDebt: true,
      hasLine: true,
      positions: [
        {
          chainId: 122,
          label: 'USD Yield',
          availableToBorrow: '$175.70',
          borrowed: '$0.80',
          creditLimit: '$176.50',
          borrowApy: '4.00%',
          borrowedProgress: 0.0045,
          backedBy: 'USD Yield',
          risk: 'none',
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

  describe('the loans the borrow-position sheet lists', () => {
    it('lists both when the cardholder owes on Fuse and on Base', () => {
      const figures = combineCreditFigures(fusePosition, RATE, {
        fuse: instance({ collateral: [asset({ amount: 213_000_000n, valueUsd: 230_000_000n })] }),
        base: baseLoan(),
      });

      expect(
        figures.positions.map(position => [position.chainId, position.label, position.backedBy]),
      ).toEqual([
        [122, 'USD Yield', 'USD Yield'],
        [8453, 'Bitcoin', 'Bitcoin'],
      ]);
      // Each tab's headline is its own instance's headroom, not the sum.
      expect(figures.positions.map(position => position.availableToBorrow)).toEqual([
        '$175.70',
        '$350',
      ]);
      expect(figures.positions[1]).toMatchObject({ borrowed: '$50', creditLimit: '$400' });
    });

    it('lists only Base when Fuse carries no debt', () => {
      const figures = combineCreditFigures(noFuseDebt, RATE, { fuse: null, base: baseLoan() });

      expect(figures.positions.map(position => position.chainId)).toEqual([8453]);
      // The combined line still counts both, for the headline.
      expect(figures.availableToBorrow).toBe('$525.70');
    });

    it('lists only Fuse when Base carries no debt', () => {
      const figures = combineCreditFigures(fusePosition, RATE, {
        fuse: null,
        base: baseLoan({ debtUsd: 0n, healthFactorWad: NO_DEBT_HF }),
      });

      expect(figures.positions.map(position => position.chainId)).toEqual([122]);
    });

    it('lists none when nothing is borrowed, leaving the combined line', () => {
      const figures = combineCreditFigures(noFuseDebt, RATE, {
        fuse: null,
        base: baseLoan({ debtUsd: 0n, healthFactorWad: NO_DEBT_HF }),
      });

      expect(figures.positions).toEqual([]);
      expect(figures.hasDebt).toBe(false);
      expect(figures.hasLine).toBe(true);
    });

    it('rates each loan by its own health factor', () => {
      const figures = combineCreditFigures(fusePosition, RATE, {
        fuse: null,
        base: baseLoan({ healthFactorWad: 1_010_000_000_000_000_000n }),
      });

      expect(figures.positions.map(position => position.risk)).toEqual(['none', 'at-risk']);
    });

    it('names every collateral a loan holds', () => {
      const figures = combineCreditFigures(noFuseDebt, RATE, {
        fuse: null,
        base: baseLoan({
          collateral: [
            asset({ chainId: 8453, token: CBBTC, symbol: 'cbBTC', amount: 1n, valueUsd: 1n }),
            asset({ chainId: 8453, token: SOL, symbol: 'SOL', amount: 1n, valueUsd: 1n }),
            asset({ chainId: 8453, token: SOEUR, symbol: 'soEUR', amount: 1n, valueUsd: 1n }),
          ],
        }),
      });

      expect(figures.positions[0].backedBy).toBe('Bitcoin, Solana and EUR Yield');
      expect(figures.positions[0].label).toBe('Bitcoin +2');
    });
  });

  describe('Base crypto collateral rows', () => {
    it('names it and draws its logo', () => {
      const figures = combineCreditFigures(noFuseDebt, RATE, { fuse: null, base: baseLoan() });

      expect(figures.collateral).toEqual([
        expect.objectContaining({ label: 'Bitcoin', icon: 'cbbtc', value: '$798.00' }),
      ]);
    });

    it('lists crypto only when held, and the yield shares always', () => {
      const figures = combineCreditFigures(noFuseDebt, RATE, {
        fuse: null,
        base: baseLoan({
          collateral: [
            asset({ chainId: 8453, token: CBBTC, symbol: 'cbBTC', amount: 0n }),
            asset({ chainId: 8453, token: SOL, symbol: 'SOL', amount: 5n, valueUsd: 500n }),
            asset({ chainId: 8453, token: SOEUR, symbol: 'soEUR', amount: 0n }),
          ],
        }),
      });

      expect(figures.collateral.map(row => row.label)).toEqual(['Solana', 'EUR Yield']);
    });
  });
});
