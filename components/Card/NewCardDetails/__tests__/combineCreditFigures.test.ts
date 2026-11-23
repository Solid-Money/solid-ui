import {
  combineCreditFigures,
  formatLtv,
} from '@/components/Card/NewCardDetails/SpendMode/useCreditModeFigures';
import { formatUsd } from '@/constants/cardSpendModule';

import type {
  CardCreditPositions,
  CreditCollateralAsset,
  CreditInstancePosition,
} from '@/hooks/useCardCreditPositions';

jest.mock('@/hooks/useCardCreditPositions', () => ({ useCardCreditPositions: jest.fn() }));
jest.mock('@/hooks/useCardSpendRegistration', () => ({ useCardSpendRegistration: jest.fn() }));
jest.mock('@/hooks/useMainCurrency', () => ({ useCardDisplayCurrency: jest.fn() }));
jest.mock('@/hooks/useCollateralOrder', () => ({ useCollateralOrder: jest.fn() }));

const RATE = 1_243_680_656n;
const SOUSD = '0x75333830E7014e909535389a6E5b0C02aA62ca27';
const SOEUR = '0x4f4B212aF8B5020399dde325e1Bc5B33b53DB70B';
const CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';
const SOL = '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82';
const BASE_SOUSD = '0x3c0c8f95D7f4265B2dc5575eBc37a6945c7a7A31';
const BASE_SOETH = '0x9b0e0EFA48C00eBEeA845AeA197F0bB71529D235';
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
  ltvWad: 900_000_000_000_000_000n,
  escrowed: 0n,
  loose: 0n,
  decimals: 18,
  priceUsd: 1_000_000n,
  priceInBand: true,
  escrowedValueUsd: 0n,
  ltWad: 950_000_000_000_000_000n,
  liquidationBonusBps: 500,
  countsTowardPower: true,
  listedAsCollateral: true,
  repayFeeBps: 0,
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
  availableToBorrowUsd: 0n,
  borrowApyPerSecond: RATE,
  collateral: [],
  unhealthySince: 0,
  forcedDebtUsd: 0n,
  pendingUnlock: null,
  liquidationsPaused: false,
  params: {
    liquidationGracePeriod: 86_400,
    graceFloorHfWad: 950_000_000_000_000_000n,
    closeFactorBps: 5_000,
    minPositionUsd: 25_000_000n,
    collateralWithdrawDelay: 300,
  },
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
          ltv: 'LTV 90%',
        },
      ],
      collateralKeys: ['USD_YIELD'],
      hasDebt: true,
      hasLine: true,
      risk: 'none',
      positions: [
        {
          chainId: 122,
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

      expect(figures.positions.map(position => [position.chainId, position.backedBy])).toEqual([
        [122, 'USD Yield'],
        [8453, 'Bitcoin'],
      ]);
      // One headline across both: the sheet's "Available to borrow".
      expect(figures.availableToBorrow).toBe('$525.70');
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
        base: baseLoan({ healthFactorWad: 990_000_000_000_000_000n }),
      });

      expect(figures.positions.map(position => position.risk)).toEqual(['none', 'at-risk']);
      // The panel's chip reports the loan closest to liquidation.
      expect(figures.risk).toBe('at-risk');
    });

    it('reads healthy when every loan is', () => {
      const figures = combineCreditFigures(fusePosition, RATE, { fuse: null, base: baseLoan() });

      expect(figures.risk).toBe('none');
      expect(figures.hasDebt).toBe(true);
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
    });
  });

  describe('each collateral row’s LTV', () => {
    it('shows the token’s own LTV under its name', () => {
      const figures = combineCreditFigures(noFuseDebt, RATE, {
        fuse: instance({ collateral: [asset({})] }),
        base: baseLoan({
          collateral: [
            asset({ chainId: 8453, token: SOEUR, symbol: 'soEUR' }),
            asset({
              chainId: 8453,
              token: CBBTC,
              symbol: 'cbBTC',
              amount: 1n,
              ltvWad: 600_000_000_000_000_000n,
            }),
          ],
        }),
      });

      expect(figures.collateral.map(row => [row.label, row.ltv])).toEqual([
        ['USD Yield', 'LTV 90%'],
        ['EUR Yield', 'LTV 90%'],
        ['Bitcoin', 'LTV 60%'],
      ]);
    });

    it('keeps a tenth of a percent, and leaves out an LTV the module never set', () => {
      expect(formatLtv(725_000_000_000_000_000n)).toBe('LTV 72.5%');
      expect(formatLtv(500_000_000_000_000_000n)).toBe('LTV 50%');
      expect(formatLtv(0n)).toBeUndefined();
    });
  });

  describe('Base crypto collateral rows', () => {
    it('names it and draws its logo', () => {
      const figures = combineCreditFigures(noFuseDebt, RATE, { fuse: null, base: baseLoan() });

      expect(figures.collateral).toEqual([
        expect.objectContaining({ label: 'Bitcoin', icon: 'cbbtc', value: '$798.00' }),
      ]);
    });

    it('never offers a token taken off the collateral list, even while some is still locked', () => {
      const figures = combineCreditFigures(noFuseDebt, RATE, {
        fuse: null,
        base: baseLoan({
          collateral: [
            asset({
              chainId: 8453,
              token: SOL,
              symbol: 'SOL',
              amount: 5n,
              escrowed: 5n,
              valueUsd: 500n,
              listedAsCollateral: false,
            }),
            asset({ chainId: 8453, token: SOEUR, symbol: 'soEUR', amount: 0n }),
          ],
        }),
      });

      expect(figures.collateral.map(row => row.label)).toEqual(['EUR Yield']);
      expect(figures.collateralKeys).not.toContain('SOL');
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

      // In the configured lock order: EUR Yield before Solana.
      expect(figures.collateral.map(row => row.label)).toEqual(['EUR Yield', 'Solana']);
    });

    it('lists soUSD on Base and soETH only when held, soUSD named for Base, soETH as ETH Yield', () => {
      const unheld = combineCreditFigures(noFuseDebt, RATE, {
        fuse: null,
        base: baseLoan({
          collateral: [
            asset({ chainId: 8453, token: BASE_SOUSD, symbol: 'soUSD', amount: 0n }),
            asset({ chainId: 8453, token: BASE_SOETH, symbol: 'soETH', amount: 0n }),
          ],
        }),
      });
      expect(unheld.collateral).toEqual([]);

      const held = combineCreditFigures(noFuseDebt, RATE, {
        fuse: null,
        base: baseLoan({
          collateral: [
            asset({
              chainId: 8453,
              token: BASE_SOUSD,
              symbol: 'soUSD',
              amount: 1n,
              valueUsd: 20_000_000n,
            }),
            asset({
              chainId: 8453,
              token: BASE_SOETH,
              symbol: 'soETH',
              amount: 1n,
              valueUsd: 2_100_000_000n,
              ltvWad: 600_000_000_000_000_000n,
            }),
          ],
        }),
      });
      expect(held.collateral.map(row => [row.label, row.icon, row.value, row.ltv])).toEqual([
        ['USD Yield on Base', 'usd', '$20.00', 'LTV 90%'],
        ['ETH Yield', 'eth', '$2,100.00', 'LTV 60%'],
      ]);
    });
  });
  describe('Base stablecoin collateral rows', () => {
    const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const BASE_USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';
    const BASE_EURC = '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42';
    const FUSE_USDC_E = '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9';
    const FUSE_USDT = '0x68c9736781E9316ebf5c3d49FE0C1f45D2D104Cd';
    const stable = (
      token: string,
      symbol: string,
      overrides: Partial<CreditCollateralAsset> = {},
    ) => asset({ chainId: 8453, token: token as `0x${string}`, symbol, decimals: 6, ...overrides });

    it('lists USDC, USDT and EURC when held, by ticker and logo, EURC in euros', () => {
      const figures = combineCreditFigures(noFuseDebt, RATE, {
        fuse: null,
        base: baseLoan({
          collateral: [
            stable(BASE_EURC, 'EURC', {
              amount: 70_000_000n,
              valueUsd: 81_600_000n,
              valueEur: 70_000_000n,
            }),
            stable(BASE_USDT, 'USDT', { amount: 5_000_000n, valueUsd: 5_000_000n }),
            stable(BASE_USDC, 'USDC', { amount: 20_000_000n, valueUsd: 20_000_000n }),
          ],
        }),
      });

      // In the default lock order: USDC, USDT, then EURC.
      expect(
        figures.collateral.map(row => [row.label, row.icon, row.value, row.usdEquivalent, row.ltv]),
      ).toEqual([
        ['USDC', 'usdc', '$20.00', undefined, 'LTV 90%'],
        ['USDT', 'usdt', '$5.00', undefined, 'LTV 90%'],
        ['EURC', 'eurc', '€70.00', '≈ $81.60', 'LTV 90%'],
      ]);
      expect(figures.collateralKeys).toEqual(['USDC', 'USDT', 'EURC']);
    });

    it('offers the stables to order when unheld, without a $0.00 row for each', () => {
      const figures = combineCreditFigures(noFuseDebt, RATE, {
        fuse: null,
        base: baseLoan({
          collateral: [
            asset({ chainId: 8453, token: SOEUR, symbol: 'soEUR' }),
            stable(BASE_USDC, 'USDC'),
            stable(BASE_EURC, 'EURC'),
          ],
        }),
      });

      expect(figures.collateral.map(row => row.label)).toEqual(['EUR Yield']);
      expect(figures.collateralKeys).toEqual(['EUR_YIELD', 'USDC', 'EURC']);
    });

    it('never lists Fuse USDC.e or USDT as collateral', () => {
      const figures = combineCreditFigures(fusePosition, RATE, {
        fuse: instance({
          collateral: [
            asset({}),
            asset({
              token: FUSE_USDC_E,
              symbol: 'USDC.e',
              decimals: 6,
              amount: 1n,
              valueUsd: 1n,
              listedAsCollateral: false,
              countsTowardPower: false,
            }),
            asset({
              token: FUSE_USDT,
              symbol: 'USDT',
              decimals: 6,
              amount: 1n,
              valueUsd: 1n,
              listedAsCollateral: false,
              countsTowardPower: false,
            }),
          ],
        }),
        base: null,
      });

      expect(figures.collateral.map(row => row.label)).toEqual(['USD Yield']);
      expect(figures.collateralKeys).toEqual(['USD_YIELD']);
    });

    it('names the stables in what a loan is backed by', () => {
      const figures = combineCreditFigures(noFuseDebt, RATE, {
        fuse: null,
        base: baseLoan({
          debtUsd: 10_000_000n,
          collateral: [
            stable(BASE_USDC, 'USDC', { amount: 30_000_000n, valueUsd: 30_000_000n }),
            stable(BASE_EURC, 'EURC', { amount: 10_000_000n, valueUsd: 11_000_000n }),
          ],
        }),
      });

      expect(figures.positions.map(loan => loan.backedBy)).toEqual(['USDC and EURC']);
    });
  });
  describe('the collateral order', () => {
    const BASE_SOBTC = '0x49d88bd2b250d57fc2c14a16a3420fb149078d00';
    const BASE_WBTC = '0x0555e30da8f98308edb960aa94c0db47230d2b9c';
    const held = (token: string, symbol: string) =>
      asset({ chainId: 8453, token: token as `0x${string}`, symbol, amount: 1n, valueUsd: 1n });

    it('lists the rows in the cardholder’s order, Fuse’s soUSD before Base’s', () => {
      const figures = combineCreditFigures(
        noFuseDebt,
        RATE,
        {
          fuse: instance({ collateral: [asset({ amount: 1n, valueUsd: 1n })] }),
          base: baseLoan({
            collateral: [
              held(BASE_SOUSD, 'soUSD'),
              held(CBBTC, 'cbBTC'),
              held(SOL, 'SOL'),
              held(SOEUR, 'soEUR'),
            ],
          }),
        },
        formatUsd,
        ['SOL', 'BTC', 'USD_YIELD', 'EUR_YIELD'],
      );

      expect(figures.collateral.map(row => row.label)).toEqual([
        'Solana',
        'Bitcoin',
        'USD Yield',
        'USD Yield on Base',
        'EUR Yield',
      ]);
    });

    it('names every collateral the card can lock, held or not, in that order', () => {
      const figures = combineCreditFigures(
        noFuseDebt,
        RATE,
        {
          fuse: instance({ collateral: [asset({})] }),
          base: baseLoan({
            collateral: [
              asset({ chainId: 8453, token: BASE_SOUSD, symbol: 'soUSD' }),
              asset({ chainId: 8453, token: CBBTC, symbol: 'cbBTC' }),
              asset({ chainId: 8453, token: BASE_SOBTC, symbol: 'soBTC' }),
              asset({ chainId: 8453, token: BASE_WBTC, symbol: 'WBTC' }),
            ],
          }),
        },
        formatUsd,
        ['WBTC', 'BTC_YIELD'],
      );

      expect(figures.collateralKeys).toEqual(['WBTC', 'BTC_YIELD', 'USD_YIELD', 'BTC']);
    });

    it('has one key for a Fuse-only card, so there is nothing to order', () => {
      const figures = combineCreditFigures(fusePosition, RATE, {
        fuse: instance({ collateral: [asset({})] }),
        base: null,
      });

      expect(figures.collateralKeys).toEqual(['USD_YIELD']);
    });

    it('names soBTC and WBTC when held', () => {
      const figures = combineCreditFigures(noFuseDebt, RATE, {
        fuse: null,
        base: baseLoan({
          collateral: [held(BASE_SOBTC, 'soBTC'), held(BASE_WBTC, 'WBTC')],
        }),
      });

      expect(figures.collateral.map(row => [row.label, row.icon])).toEqual([
        ['BTC Yield', 'sobtc'],
        ['Wrapped Bitcoin', 'wbtc'],
      ]);
    });
  });
});
