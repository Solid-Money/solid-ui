import { findAdditionalCollateral } from '@/components/Card/Credit/collateralDiscovery';
import { loanSafetyStatus, summarizeLoanSafety } from '@/components/Card/Credit/loanSafety';
import {
  buildLoan,
  debtAtUnlock,
  formatClock,
  formatWait,
  freeToUnlock,
  quoteUnlock,
  roundUpToStep,
  statusOf,
  UNLOCK_INTEREST_HEADROOM_SECONDS,
  WAD,
} from '@/lib/creditRisk';

import type { CreditCollateralAsset, CreditInstancePosition } from '@/hooks/useCardCreditPositions';

/**
 * Round-number positions, so every expected figure can be checked by hand against the module's
 * rules: cover = value × threshold, power = value × LTV, health = cover ÷ debt.
 */

const usd = (dollars: number) => BigInt(Math.round(dollars * 1_000_000));
const wad = (fraction: number) => BigInt(Math.round(fraction * 1e6)) * 10n ** 12n;
const NOW = 1_800_000_000;

let tokenSeq = 0;
/** One locked asset priced at $1 a unit with 6 decimals: units and dollars are the same number. */
const asset = (
  symbol: string,
  dollars: number,
  ltv: number,
  lt: number,
  overrides: Partial<CreditCollateralAsset> = {},
): CreditCollateralAsset => {
  tokenSeq += 1;
  const amount = usd(dollars);
  return {
    chainId: 8453,
    token: `0x${tokenSeq.toString(16).padStart(40, '0')}` as `0x${string}`,
    symbol,
    amount,
    valueUsd: amount,
    priceUsable: true,
    ltvWad: wad(ltv),
    escrowed: amount,
    loose: 0n,
    decimals: 6,
    priceUsd: 1_000_000n,
    priceInBand: true,
    escrowedValueUsd: amount,
    ltWad: wad(lt),
    liquidationBonusBps: lt >= 0.9 ? 500 : lt >= 0.7 ? 500 : 750,
    countsTowardPower: true,
    listedAsCollateral: true,
    repayFeeBps: 0,
    ...overrides,
  };
};

/** Bitcoin at $100,000 with 8 decimals, worth `dollars`. */
const bitcoin = (dollars: number, overrides: Partial<CreditCollateralAsset> = {}) => {
  const units = BigInt(Math.round((dollars / 100_000) * 1e8));
  return asset('cbBTC', dollars, 0.6, 0.7, {
    amount: units,
    escrowed: units,
    decimals: 8,
    priceUsd: usd(100_000),
    ...overrides,
  });
};

const position = (
  debtDollars: number,
  collateral: CreditCollateralAsset[],
  overrides: Partial<CreditInstancePosition> = {},
): CreditInstancePosition => {
  const debtUsd = usd(debtDollars);
  const cover = collateral.reduce((sum, a) => sum + (a.escrowedValueUsd * a.ltWad) / WAD, 0n);
  return {
    chainId: 8453,
    moduleAddress: '0x47A5e832E1178726dd13AdD762774A704878AD98',
    debtUsd,
    healthFactorWad: debtUsd === 0n ? 2n ** 256n - 1n : (cover * WAD) / debtUsd,
    fullyPriced: true,
    creditLineUsd: 0n,
    creditHeadroomUsd: 0n,
    availableToBorrowUsd: 0n,
    borrowApyPerSecond: 0n,
    collateral,
    unhealthySince: 0,
    forcedDebtUsd: 0n,
    pendingUnlock: null,
    liquidationsPaused: false,
    params: {
      liquidationGracePeriod: 86_400,
      graceFloorHfWad: wad(0.95),
      closeFactorBps: 5_000,
      minPositionUsd: usd(25),
      collateralWithdrawDelay: 300,
    },
    ...overrides,
  };
};

/** The Base loan in the design: €70 of EUR Yield ($81) and $930.23 of Bitcoin, $600 owed. */
const designLoan = (overrides: Partial<CreditInstancePosition> = {}) =>
  position(600, [asset('soEUR', 81, 0.9, 0.95), bitcoin(930.23)], overrides);

/** Six assets, $880 owed. */
const sixAssets = () => {
  const assets = [
    asset('soEUR', 81, 0.9, 0.95),
    asset('cbBTC', 500, 0.6, 0.7),
    asset('WETH', 400, 0.6, 0.7),
    asset('SOL', 300, 0.5, 0.6),
    asset('AAVE', 200, 0.5, 0.6),
    asset('cbZEC', 150, 0.5, 0.6),
  ];
  return { assets, position: position(880, assets) };
};

describe('additional collateral', () => {
  it('excludes assets held on any instance and deduplicates unheld eligible assets', () => {
    const heldOnFuse = asset('soUSD', 20, 0.9, 0.95, { chainId: 122 });
    const emptyOnBase = asset('soUSD', 0, 0.9, 0.95);
    const weth = asset('WETH', 0, 0.6, 0.7);
    const emptyOnFuse = asset('WETH', 0, 0.6, 0.7, { chainId: 122 });
    const ethYield = asset('soETH', 0, 0.6, 0.7);

    expect(
      findAdditionalCollateral([emptyOnBase, weth, heldOnFuse, emptyOnFuse, ethYield]),
    ).toEqual([weth, ethYield]);
  });

  it('excludes paused, delisted and zero-LTV assets', () => {
    const paused = asset('AAVE', 0, 0.5, 0.6, { countsTowardPower: false });
    const delisted = asset('cbZEC', 0, 0.5, 0.6, { listedAsCollateral: false });
    const zeroLtv = asset('SOL', 0, 0, 0.6);

    expect(findAdditionalCollateral([paused, delisted, zeroLtv])).toEqual([]);
  });
});

describe('statusOf', () => {
  it('is Healthy at and above 1.05, Getting close below it, At risk only under 1.0', () => {
    expect(statusOf(wad(1.11), usd(100))).toBe('healthy');
    expect(statusOf(wad(1.05), usd(100))).toBe('healthy');
    expect(statusOf(wad(1.049), usd(100))).toBe('caution');
    expect(statusOf(wad(1.0), usd(100))).toBe('caution');
    expect(statusOf(wad(0.999), usd(100))).toBe('at-risk');
  });

  it('never reports a loan with nothing owed', () => {
    expect(statusOf(wad(0.5), 0n)).toBe('healthy');
  });
});

describe('Credit page loan safety', () => {
  it('shows an early red warning while keeping actual sales below 1.0', () => {
    const atHealth = (health: number) =>
      buildLoan(designLoan({ healthFactorWad: wad(health) }), NOW);
    expect(loanSafetyStatus(atHealth(1.05))).toBe('healthy');
    expect(loanSafetyStatus(atHealth(1.02))).toBe('caution');
    const near = atHealth(1.01);
    expect(loanSafetyStatus(near)).toBe('at-risk');
    expect(near.sale).toBeNull();
    expect(atHealth(0.99).sale).toEqual({ kind: 'unrecorded' });
  });

  it('uses the worst warning and keeps each active loan’s own status in chain order', () => {
    const fuse = buildLoan(position(400, [asset('soUSD', 440, 0.9, 0.95)], { chainId: 122 }), NOW);
    const base = buildLoan(designLoan({ healthFactorWad: wad(1.01) }), NOW);
    const repaid = buildLoan(position(0, [asset('soEUR', 50, 0.9, 0.95)]), NOW);

    expect(summarizeLoanSafety([base, repaid, fuse], false)).toEqual({
      status: 'at-risk',
      affectedLoan: base,
      positions: [
        { loan: fuse, status: 'caution' },
        { loan: base, status: 'at-risk' },
      ],
    });
    expect(summarizeLoanSafety([repaid], false).positions).toEqual([]);
  });

  it('withholds a safe banner when a read or a price is unavailable', () => {
    const healthy = buildLoan(designLoan(), NOW);
    const unpriced = buildLoan(
      designLoan({ collateral: [bitcoin(930.23, { priceInBand: false })] }),
      NOW,
    );
    expect(summarizeLoanSafety([healthy], true).status).toBe('unknown');
    expect(summarizeLoanSafety([unpriced], false).positions[0].status).toBe('unknown');
  });
});

describe('buildLoan — one volatile asset', () => {
  const loan = buildLoan(designLoan(), NOW);

  it('blends the sell line across the loan’s assets', () => {
    // cover 76.95 + 651.161 = 728.111 over 1,011.23 of value
    expect(loan.coverUsd).toBe(usd(728.111));
    expect(loan.soldAt).toBeCloseTo(0.72, 2);
    expect(loan.ltv).toBeCloseTo(0.5933, 3);
    expect(loan.status).toBe('healthy');
  });

  it('gives the exact price for the one asset that can move, counting the steady one', () => {
    expect(loan.risk.kind).toBe('single');
    if (loan.risk.kind !== 'single') return;
    // (600 − 76.95) / 651.161 of today’s $100,000
    expect(Number(loan.risk.sellPriceUsd) / 1e6).toBeCloseTo(80_325.76, 0);
    expect(loan.risk.drop).toBeCloseTo(0.1967, 3);
    // (570 − 76.95) / 651.161: under this there is no wait
    expect(Number(loan.risk.noWaitPriceUsd) / 1e6).toBeCloseTo(75_718.7, 0);
  });

  it('caps one sale at the close factor', () => {
    expect(loan.maxSaleUsd).toBe(usd(300));
    expect(buildLoan(position(20, [asset('soUSD', 30, 0.9, 0.95)]), NOW).maxSaleUsd).toBe(usd(20));
  });
});

describe('buildLoan — several volatile assets', () => {
  const { position: six } = sixAssets();
  const loan = buildLoan(six, NOW);

  it('says how far the crypto can fall together, with Yield assets held steady', () => {
    expect(loan.coverUsd).toBe(usd(1096.95));
    expect(loan.powerUsd).toBe(usd(937.9));
    expect(loan.risk.kind).toBe('multi');
    if (loan.risk.kind === 'multi') expect(loan.risk.togetherDrop).toBeCloseTo(0.2127, 3);
  });

  it('says which assets could cause a sale alone, and how far they would have to fall', () => {
    const byName = Object.fromEntries(loan.assets.map(a => [a.symbol, a]));
    expect(byName.cbBTC.aloneDrop).toBeCloseTo(0.62, 2);
    expect(byName.WETH.aloneDrop).toBeCloseTo(0.775, 3);
    expect(byName.SOL.aloneDrop).toBeNull();
    expect(byName.soEUR.aloneDrop).toBeNull();
    expect(loan.penaltyBps).toEqual({ min: 500, max: 750 });
  });

  it('says when the crypto cannot put the loan at risk even falling to nothing', () => {
    // $120 of steady cover against $100 owed; the crypto adds $30 more.
    const covered = buildLoan(
      position(100, [
        asset('soUSD', 126.32, 0.9, 0.95),
        asset('cbBTC', 25, 0.6, 0.7),
        asset('SOL', 21.67, 0.5, 0.6),
      ]),
      NOW,
    );
    expect(covered.risk).toEqual({ kind: 'multi', togetherDrop: null });
  });

  it('suggests no pay-down while the loan is comfortably healthy', () => {
    expect(loan.payDown).toBeNull();
  });
});

describe('buildLoan — when a sale can happen', () => {
  // $723.50 of Bitcoin left: cover 583.40, health ≈ 0.972
  const atRisk = (overrides: Partial<CreditInstancePosition> = {}) =>
    position(600, [asset('soEUR', 81, 0.9, 0.95), bitcoin(723.5)], overrides);

  it('counts down from the recorded moment through the grace period', () => {
    const loan = buildLoan(atRisk({ unhealthySince: NOW - 3_600 }), NOW);
    expect(loan.status).toBe('at-risk');
    expect(loan.sale).toEqual({
      kind: 'countdown',
      startedAt: NOW - 3_600,
      saleAt: NOW - 3_600 + 86_400,
    });
  });

  it('allows a sale once the wait is over', () => {
    expect(buildLoan(atRisk({ unhealthySince: NOW - 90_000 }), NOW).sale).toEqual({ kind: 'now' });
  });

  it('skips the wait below the floor, unless the loan carries a forced charge', () => {
    const deep = position(600, [asset('soEUR', 81, 0.9, 0.95), bitcoin(600)], {
      unhealthySince: NOW - 60,
    });
    expect(buildLoan(deep, NOW).sale).toEqual({ kind: 'now' });
    expect(buildLoan({ ...deep, forcedDebtUsd: usd(100) }, NOW).sale?.kind).toBe('countdown');
  });

  it('cannot start the wait until the loan is recorded under 1.0', () => {
    expect(buildLoan(atRisk(), NOW).sale).toEqual({ kind: 'unrecorded' });
  });

  it('refuses a sale while a price is out of range or sales are paused', () => {
    const outOfBand = position(
      600,
      [asset('soEUR', 81, 0.9, 0.95), bitcoin(723.5, { priceInBand: false })],
      {
        unhealthySince: NOW - 90_000,
      },
    );
    expect(buildLoan(outOfBand, NOW).sale).toEqual({ kind: 'prices-updating' });
    expect(
      buildLoan(atRisk({ unhealthySince: NOW - 90_000, liquidationsPaused: true }), NOW).sale,
    ).toEqual({
      kind: 'paused',
    });
  });

  it('suggests paying down with the asset that lifts the loan most, sized to get back to Healthy', () => {
    const loan = buildLoan(atRisk({ unhealthySince: NOW - 60 }), NOW);
    expect(loan.payDown?.asset.symbol).toBe('cbBTC');
    // (1.10 × 600 − 583.40) / (1.10 − 0.70) = 191.50 → 195
    expect(loan.payDown?.amountUsd).toBe(usd(195));
    expect(loan.payDown?.reachesTarget).toBe(true);
  });

  it('prefers an asset that can reach Healthy over a smaller one with a lower threshold', () => {
    // $1 at 60% cannot lift a $480 loan; $600 at 80% can, with $160 rounded up.
    const loan = buildLoan(
      position(480, [asset('SOL', 1, 0.5, 0.6), asset('WETH', 600, 0.7, 0.8)], {
        unhealthySince: NOW - 60,
      }),
      NOW,
    );
    expect(loan.payDown?.asset.symbol).toBe('WETH');
    expect(loan.payDown?.reachesTarget).toBe(true);
  });

  it('gives no no-wait price to a loan carrying a forced charge', () => {
    const loan = buildLoan(atRisk({ unhealthySince: NOW - 60, forcedDebtUsd: usd(50) }), NOW);
    expect(loan.risk.kind).toBe('single');
    if (loan.risk.kind === 'single') expect(loan.risk.noWaitPriceUsd).toBeNull();
  });
});

describe('a token taken off the collateral list', () => {
  it('still backs the loan while it is locked, without adding borrowing power', () => {
    const delisted = asset('SOL', 300, 0.5, 0.6, {
      listedAsCollateral: false,
      countsTowardPower: false,
    });
    const loan = buildLoan(position(100, [asset('soUSD', 200, 0.9, 0.95), delisted]), NOW);
    const sol = loan.assets.find(a => a.symbol === 'SOL')!;
    expect(sol.escrowed).toBe(usd(300));
    // 300 × 60% of cover, none of power.
    expect(sol.coverUsd).toBe(usd(180));
    expect(sol.powerUsd).toBe(0n);
  });
});

describe('pay-down suggestion', () => {
  it('never suggests repaying with an asset that would lower the loan’s health', () => {
    // Health 0.90 against soUSD's 0.95 threshold: each dollar repaid with it removes more cover
    // than debt, and it cannot clear the loan.
    const underwater = position(105.56, [asset('soUSD', 100, 0.9, 0.95)]);
    expect(buildLoan(underwater, NOW).payDown).toBeNull();
  });
});

describe('unlocking while the loan stays open', () => {
  const { position: six } = sixAssets();
  const loan = buildLoan(six, NOW);
  const eth = loan.assets.find(a => a.symbol === 'WETH')!;
  const sol = loan.assets.find(a => a.symbol === 'SOL')!;
  const btc = loan.assets.find(a => a.symbol === 'cbBTC')!;

  it('frees what the spare borrowing power covers, at the asset’s own LTV', () => {
    // 57.90 spare ÷ 60%
    expect(freeToUnlock(loan, eth).valueUsd).toBe(usd(96.5));
    // ÷ 50%
    expect(freeToUnlock(loan, sol).valueUsd).toBe(usd(115.8));
  });

  it('asks for the repayment that keeps debt within borrowing power, rounded up to $5', () => {
    const quote = quoteUnlock({
      position: six,
      loan,
      asset: eth,
      amount: usd(200),
      source: { kind: 'wallet' },
      nowSeconds: NOW,
    });
    // 880 − (937.90 − 200 × 60%)
    expect(quote.neededUsd).toBe(usd(62.1));
    expect(quote.repayUsd).toBe(usd(65));
    expect(quote.debtAfterUsd).toBe(usd(815));
    expect(quote.requiresFullRepay).toBe(false);
    expect(quote.after.status).toBe('healthy');
    expect(quote.after.risk.kind).toBe('multi');
    if (quote.after.risk.kind === 'multi')
      expect(quote.after.risk.togetherDrop).toBeCloseTo(0.1613, 3);
  });

  it('takes more from another locked asset, which stops backing the loan too', () => {
    const quote = quoteUnlock({
      position: six,
      loan,
      asset: eth,
      amount: usd(200),
      source: { kind: 'collateral', asset: sol },
      nowSeconds: NOW,
    });
    // 62.10 ÷ (1 − 50%) = 124.20 → 125
    expect(quote.repayUsd).toBe(usd(125));
    expect(quote.unavailableReason).toBeNull();
  });

  it('needs nothing repaid inside the free amount', () => {
    const quote = quoteUnlock({
      position: six,
      loan,
      asset: eth,
      amount: usd(90),
      source: { kind: 'wallet' },
      nowSeconds: NOW,
    });
    expect(quote.repayUsd).toBe(0n);
  });

  it('turns an unlock that needs the whole debt into a full repayment', () => {
    const single = position(400, [asset('soUSD', 467.84, 0.9, 0.95)]);
    const singleLoan = buildLoan(single, NOW);
    const quote = quoteUnlock({
      position: single,
      loan: singleLoan,
      asset: singleLoan.assets[0],
      amount: singleLoan.assets[0].escrowed,
      source: { kind: 'wallet' },
      nowSeconds: NOW,
    });
    expect(quote.requiresFullRepay).toBe(true);
    expect(quote.repayUsd).toBe(usd(400));
  });

  it('repays to the cent rather than the whole loan when the $5 step would reach the debt', () => {
    const small = position(10, [asset('soUSD', 100, 0.9, 0.95)]);
    const smallLoan = buildLoan(small, NOW);
    const quote = quoteUnlock({
      position: small,
      loan: smallLoan,
      asset: smallLoan.assets[0],
      amount: usd(97),
      source: { kind: 'wallet' },
      nowSeconds: NOW,
    });
    // 10 − (90 − 97 × 90%) = 7.30 → 7.31; the $5 step would be 10, the whole debt.
    expect(quote.requiresFullRepay).toBe(false);
    expect(quote.repayUsd).toBe(usd(7.31));
    expect(quote.unavailableReason).toBeNull();
  });

  it('sizes unlocking all of one asset from the rest of the loan', () => {
    const quote = quoteUnlock({
      position: six,
      loan,
      asset: btc,
      amount: btc.escrowed,
      source: { kind: 'wallet' },
      nowSeconds: NOW,
    });
    // 880 − (937.90 − 300)
    expect(quote.neededUsd).toBe(usd(242.1));
    expect(quote.repayUsd).toBe(usd(245));
  });

  it('leaves room for the interest that runs before the unlock is finished', () => {
    // 10% a year, per second, as the module stores it.
    const apy = wad(0.1) / 31_536_000n;
    const accruing = position(880, sixAssets().assets, { borrowApyPerSecond: apy });
    const accruingLoan = buildLoan(accruing, NOW);
    const weth = accruingLoan.assets.find(a => a.symbol === 'WETH')!;
    const seconds = BigInt(300 + UNLOCK_INTEREST_HEADROOM_SECONDS);
    const interest = (usd(880) * apy * seconds + WAD - 1n) / WAD;
    expect(debtAtUnlock(accruingLoan)).toBe(usd(880) + interest);

    const free = freeToUnlock(accruingLoan, weth);
    expect(free.valueUsd).toBeLessThan(usd(96.5));
    const quote = quoteUnlock({
      position: accruing,
      loan: accruingLoan,
      asset: weth,
      amount: free.amount,
      source: { kind: 'wallet' },
      nowSeconds: NOW,
    });
    expect(quote.repayUsd).toBe(0n);
    // Still within borrowing power once the wait and the headroom have run.
    expect(debtAtUnlock(quote.after)).toBeLessThanOrEqual(quote.after.powerUsd);
  });

  it('takes a collateral repayment as the module does: principal and fee each rounded up', () => {
    // 0.01 BTC at $99,999 with a 1% fee: $5 is 5,000.05 → 5,001 units, the fee 50.01 → 51.
    const btcSource = bitcoin(999.99, {
      priceUsd: usd(99_999),
      amount: 1_000_000n,
      escrowed: 1_000_000n,
      repayFeeBps: 100,
    });
    const stable = asset('soUSD', 100, 0.9, 0.95);
    // Exactly at borrowing power: 100 × 90% + 999.99 × 60%.
    const atPower = position(689.994, [stable, btcSource]);
    const atPowerLoan = buildLoan(atPower, NOW);
    const quote = quoteUnlock({
      position: atPower,
      loan: atPowerLoan,
      asset: atPowerLoan.assets.find(a => a.symbol === 'soUSD')!,
      amount: usd(1),
      source: { kind: 'collateral', asset: atPowerLoan.assets.find(a => a.symbol === 'cbBTC')! },
      nowSeconds: NOW,
    });
    expect(quote.repayUsd).toBe(usd(5));
    expect(quote.after.assets.find(a => a.symbol === 'cbBTC')!.escrowed).toBe(1_000_000n - 5_052n);
    expect(quote.unavailableReason).toBeNull();
  });
});

describe('formatting', () => {
  it('rounds a repayment up to the next whole step, never onto the figure itself', () => {
    expect(roundUpToStep(usd(62.1))).toBe(usd(65));
    expect(roundUpToStep(usd(15))).toBe(usd(20));
    expect(roundUpToStep(0n)).toBe(0n);
  });

  it('writes waits the way the page reads them', () => {
    expect(formatWait(17 * 3600 + 40 * 60)).toBe('17h 40m');
    expect(formatWait(40 * 60)).toBe('40m');
    expect(formatClock(252)).toBe('4:12');
  });
});
