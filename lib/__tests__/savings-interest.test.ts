/// <reference types="jest" />

/**
 * Regression tests for the "Interest earned" counter.
 *
 * Reported behaviour: interest showed +1.50 at a 14% headline rate; the rate
 * moved to 13.59% and interest dropped to +0.75 — a ~2x fall from a ~3% rate
 * change. Two defects produced that:
 *
 *   1. CURRENT mode returned `realized profit + APY x (now - firstDeposit)`,
 *      double-counting the holding period and making a measurement scale with a
 *      forecast rate, so a rate change re-priced all of history.
 *   2. When deposit history was momentarily unavailable the same mode silently
 *      returned the projection *alone* — roughly half of realized+projection —
 *      so the number swung by ~2x with nothing changing on-chain.
 *
 * Interest earned is now realized profit only (total value - total deposited),
 * and "unknown" is reported as INTEREST_UNAVAILABLE instead of a guess.
 */

import {
  calculateYield,
  clearExchangeRateCache,
  clearVaultTransfersCache,
  INTEREST_UNAVAILABLE,
} from '@/lib/financial';
import { SavingMode } from '@/lib/types';

// jest.mock calls are hoisted above the imports above.
jest.mock('@/graphql/clients', () => ({
  getInfoClient: () => ({
    query: jest.fn().mockResolvedValue({ data: { exchangeRateUpdates: [] } }),
  }),
}));

jest.mock('@/store/useBalanceStore', () => ({
  useBalanceStore: { getState: () => ({ setEarnedUSD: jest.fn() }) },
}));

const SAFE = '0x1111111111111111111111111111111111111111';
const USDC_VAULT = '0xcE0B0E7B6a8a2571AA9B47bFB4Ac6D0F2fF5CE60';

const YEAR_SECONDS = 31_557_600;
const NOW = 1_800_000_000;
const ONE_YEAR_AGO = NOW - YEAR_SECONDS;

/** 1000 USDC deposited a year ago (6 decimals). */
const deposits = [{ depositAmount: '1000000000', depositTimestamp: String(ONE_YEAR_AGO) }];
const withdraws: unknown[] = [];

const interestFor = (balance: number, apy: number, mode = SavingMode.CURRENT) =>
  calculateYield(
    balance,
    apy,
    ONE_YEAR_AGO,
    NOW,
    mode,
    { deposits, withdraws },
    SAFE,
    1, // exchange rate: 1 soUSD = 1 USD
    USDC_VAULT,
    6,
  );

beforeEach(() => {
  clearExchangeRateCache();
  clearVaultTransfersCache();
  // No on-chain vault transfers: deposits/withdraws above are the whole history.
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items: [] }),
  }) as unknown as typeof fetch;
});

describe('calculateYield — interest earned is a measurement, not a forecast', () => {
  it('reports realized profit only, with no APY projection layered on top', async () => {
    // 1010 soUSD at rate 1.0 against 1000 deposited = 10.00 realized.
    // The old formula added 1010 x 14% x 1yr = ~141 on top of that.
    await expect(interestFor(1010, 14)).resolves.toBeCloseTo(10, 6);
  });

  it('does not move when the APY changes', async () => {
    const [at14, at1359, at0] = await Promise.all([
      interestFor(1010, 14),
      interestFor(1010, 13.59),
      interestFor(1010, 0),
    ]);

    expect(at1359).toBeCloseTo(at14, 6);
    expect(at0).toBeCloseTo(at14, 6);
  });

  it('still reports interest when the APY fetch failed (NaN)', async () => {
    // APY is not an input to a measurement, so losing it must not blank the value.
    await expect(interestFor(1010, NaN)).resolves.toBeCloseTo(10, 6);
  });

  it('clamps a position that is underwater to zero rather than going negative', async () => {
    await expect(interestFor(990, 14)).resolves.toBe(0);
  });

  it('treats INTEREST_ONLY the same as CURRENT', async () => {
    await expect(interestFor(1010, 14, SavingMode.INTEREST_ONLY)).resolves.toBeCloseTo(10, 6);
  });

  it('reports INTEREST_UNAVAILABLE instead of a projection when deposit history is missing', async () => {
    // This is the ~2x swing: the old code returned 1010 x 14% x 1yr (~141) here.
    const noHistory = await calculateYield(
      1010,
      14,
      ONE_YEAR_AGO,
      NOW,
      SavingMode.CURRENT,
      undefined,
      SAFE,
      1,
      USDC_VAULT,
      6,
    );

    expect(noHistory).toBe(INTEREST_UNAVAILABLE);
  });

  it('reports INTEREST_UNAVAILABLE when no deposit start time is known', async () => {
    const noStart = await calculateYield(
      1010,
      14,
      0,
      NOW,
      SavingMode.CURRENT,
      undefined,
      SAFE,
      1,
      USDC_VAULT,
      6,
    );

    expect(noStart).toBe(INTEREST_UNAVAILABLE);
  });

  it('returns 0 interest for an empty position', async () => {
    await expect(interestFor(0, 14)).resolves.toBe(0);
  });
});
