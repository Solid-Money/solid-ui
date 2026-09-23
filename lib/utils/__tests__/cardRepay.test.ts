import { decodeFunctionData, erc20Abi, getAddress, maxUint256 } from 'viem';

import { SolidCashModuleV2_ABI } from '@/lib/abis/SolidCashModuleV2';
import {
  bufferedDebtUsd,
  buildRepayCalls,
  type EscrowedCollateral,
  parseUsdAmountText,
  quoteRepay,
  repayDisplaySymbol,
  type RepaySource,
  repayTokenEstimate,
  sanitizeUsdAmountText,
  tokenToUsdFloor,
  usdToTokenCeil,
} from '@/lib/utils/cardRepay';

/**
 * Figures are a real position on the deployed module (Fuse, 2026-09-23): $304.77 of debt
 * against 318.87 soUSD escrowed, with 3,676.84 soUSD loose in the Safe. Every call shape here
 * was also run against a fork of that state, and the returned-collateral estimate below came
 * out within interest-accrual dust of what the fork actually returned.
 */
// Checksummed, because that is how `decodeFunctionData` hands addresses back.
const SAFE = getAddress('0x000acc8042ea362149ce2b2709fc497b6505634e');
const MODULE = getAddress('0xE2d4FB3d1eeD6Bdc3fD62A93ab35A33FC3c97b2B');
const SOUSD = getAddress('0x75333830E7014e909535389a6E5b0C02aA62ca27');
const USDC = getAddress('0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9');

const DEBT = 304_766_745n;
const SOUSD_PRICE = 1_080_875n;
const ESCROWED = 318_873_663n;
const LOOSE = 3_676_844_231n;
const RATE = 1_243_680_656n;

const source = (overrides: Partial<RepaySource> & Pick<RepaySource, 'kind'>): RepaySource => {
  const balance = overrides.balance ?? (overrides.kind === 'wallet' ? LOOSE : ESCROWED);
  const priceUsd = overrides.priceUsd ?? SOUSD_PRICE;
  return {
    id: `${overrides.kind}:${SOUSD}`,
    token: SOUSD,
    symbol: 'soUSD',
    displaySymbol: 'soUSD',
    decimals: 6,
    unavailableReason: null,
    ...overrides,
    balance,
    priceUsd,
    valueUsd: overrides.valueUsd ?? tokenToUsdFloor(balance, priceUsd, 6),
  };
};

const collateral: EscrowedCollateral[] = [
  {
    token: SOUSD,
    symbol: 'soUSD',
    displaySymbol: 'soUSD',
    decimals: 6,
    priceUsd: SOUSD_PRICE,
    amount: ESCROWED,
  },
];

const quote = (
  from: RepaySource,
  amountUsd: bigint | null,
  isMax = false,
  debtUsd = DEBT,
  held: EscrowedCollateral[] = collateral,
) =>
  quoteRepay({
    debtUsd,
    borrowApyPerSecond: RATE,
    source: from,
    collateral: held,
    amountUsd,
    isMax,
  });

const decodeModule = (data: `0x${string}`) =>
  decodeFunctionData({ abi: SolidCashModuleV2_ABI, data });

describe('rounding', () => {
  it('values delivered tokens down and sizes taken tokens up, like the module', () => {
    expect(tokenToUsdFloor(ESCROWED, SOUSD_PRICE, 6)).toBe(344_662_570n);
    expect(usdToTokenCeil(DEBT, SOUSD_PRICE, 6)).toBe(281_962_989n);
    // Ceil then floor never lands under the figure asked for.
    const tokens = usdToTokenCeil(50_000_000n, SOUSD_PRICE, 6);
    expect(tokenToUsdFloor(tokens, SOUSD_PRICE, 6)).toBeGreaterThanOrEqual(50_000_000n);
  });

  it('pads the debt for accrual and a reprint', () => {
    const buffered = bufferedDebtUsd(DEBT, RATE);
    expect(buffered).toBeGreaterThan(DEBT);
    // Ten basis points plus an hour of interest, not more.
    expect(buffered - DEBT).toBeLessThan((DEBT * 12n) / 10_000n);
  });
});

describe('quoteRepay', () => {
  it('says nothing while the field is empty', () => {
    expect(quote(source({ kind: 'wallet' }), null)).toEqual({ ok: false, reason: null });
    expect(quote(source({ kind: 'wallet' }), 0n)).toEqual({ ok: false, reason: null });
  });

  it('refuses when there is no debt', () => {
    expect(quote(source({ kind: 'wallet' }), 1_000_000n, false, 0n)).toEqual({
      ok: false,
      reason: 'You have nothing to repay.',
    });
  });

  it('quotes a partial wallet repayment in token units rounded up', () => {
    const result = quote(source({ kind: 'wallet' }), 50_000_000n);
    expect(result).toMatchObject({
      ok: true,
      isFull: false,
      useMax: false,
      repayUsd: 50_000_000n,
      tokenAmount: 46_258_819n,
      remainingDebtUsd: DEBT - 50_000_000n,
      returnedCollateral: [],
    });
  });

  it('treats the on-screen cent the debt rounds up to as repaying all of it', () => {
    const result = quote(source({ kind: 'wallet' }), 304_770_000n);
    expect(result).toMatchObject({ ok: true, isFull: true, useMax: true, remainingDebtUsd: 0n });
  });

  it('refuses a figure beyond what is owed rather than clamping it', () => {
    expect(quote(source({ kind: 'wallet' }), 304_780_000n)).toEqual({
      ok: false,
      reason: 'You owe $304.77.',
    });
  });

  it('refuses more than the source holds', () => {
    const thin = source({ kind: 'wallet', balance: 10_000_000n });
    const result = quote(thin, 50_000_000n);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(/^Not enough soUSD in your wallet/);
  });

  it('refuses a source with nothing in it', () => {
    const empty = source({
      kind: 'wallet',
      token: USDC,
      symbol: 'USDC.e',
      displaySymbol: 'USDC',
      balance: 0n,
    });
    expect(quote(empty, 1_000_000n)).toEqual({
      ok: false,
      reason: 'You have no USDC in your wallet.',
    });
  });

  it('surfaces why a source is unavailable', () => {
    const paused = source({ kind: 'wallet', unavailableReason: 'soUSD is paused right now.' });
    expect(quote(paused, 1_000_000n)).toEqual({ ok: false, reason: 'soUSD is paused right now.' });
  });

  it('MAX from a source smaller than the debt repays all of the source and keeps the loan', () => {
    const thin = source({ kind: 'wallet', balance: 100_000_000n });
    const result = quote(thin, null, true);
    expect(result).toMatchObject({ ok: true, isFull: false, useMax: true, returnedCollateral: [] });
    expect(result.ok && result.remainingDebtUsd).toBe(DEBT - thin.valueUsd);
  });

  it('a full wallet repayment returns every escrowed balance', () => {
    const result = quote(source({ kind: 'wallet' }), null, true);
    expect(result).toMatchObject({ ok: true, isFull: true, useMax: true });
    expect(result.ok && result.returnedCollateral).toEqual([
      { token: SOUSD, displaySymbol: 'soUSD', decimals: 6, amount: ESCROWED },
    ]);
  });

  it('a full collateral repayment returns what the debt did not need', () => {
    const result = quote(source({ kind: 'collateral' }), null, true);
    expect(result).toMatchObject({ ok: true, isFull: true, useMax: true, tokenAmount: null });
    // 318.87 soUSD escrowed less the 281.96 the debt takes. The fork returned 36,910,659.
    expect(result.ok && result.returnedCollateral).toEqual([
      { token: SOUSD, displaySymbol: 'soUSD', decimals: 6, amount: 36_910_674n },
    ]);
  });

  it('withdraws nothing when the source only just covers the debt', () => {
    // Clears the debt as quoted but not the buffer: interest or a reprint could leave dust,
    // and `withdrawCollateral` would then revert the whole batch.
    const exact = source({ kind: 'wallet', balance: usdToTokenCeil(DEBT, SOUSD_PRICE, 6) });
    const result = quote(exact, null, true);
    expect(result).toMatchObject({ ok: true, isFull: true, returnedCollateral: [] });
  });

  it('never withdraws a balance the repayment itself exhausts', () => {
    // Collateral worth the debt plus a hair: covers it, but the buffered spend exceeds it.
    const escrowed = usdToTokenCeil(DEBT, SOUSD_PRICE, 6) + 1n;
    const held = [{ ...collateral[0], amount: escrowed }];
    const result = quote(source({ kind: 'collateral', balance: escrowed }), null, true, DEBT, held);
    expect(result).toMatchObject({ ok: true, isFull: true, returnedCollateral: [] });
  });
});

describe('repayTokenEstimate', () => {
  const estimate = (from: RepaySource, amountUsd: bigint | null, isMax = false) =>
    repayTokenEstimate({
      source: from,
      quote: quote(from, amountUsd, isMax),
      debtUsd: DEBT,
      amountUsd,
      isMax,
    });

  it('is the exact amount sent for a partial wallet repayment', () => {
    expect(estimate(source({ kind: 'wallet' }), 50_000_000n)).toEqual({
      amount: 46_258_819n,
      isExact: true,
    });
  });

  it('estimates what the module will size for a full or collateral repayment', () => {
    expect(estimate(source({ kind: 'wallet' }), null, true)).toEqual({
      amount: 281_962_989n,
      isExact: false,
    });
    expect(estimate(source({ kind: 'collateral' }), 100_000_000n)).toEqual({
      amount: usdToTokenCeil(100_000_000n, SOUSD_PRICE, 6),
      isExact: false,
    });
  });

  it('still converts a figure the quote refuses', () => {
    const thin = source({ kind: 'wallet', balance: 10_000_000n });
    expect(estimate(thin, 50_000_000n)).toEqual({ amount: 46_258_819n, isExact: false });
  });

  it('shows nothing without an amount or a price', () => {
    expect(estimate(source({ kind: 'wallet' }), null)).toBeNull();
    expect(
      estimate(source({ kind: 'wallet', priceUsd: 0n, valueUsd: 0n }), 50_000_000n),
    ).toBeNull();
  });
});

describe('buildRepayCalls', () => {
  it('repays a partial wallet amount through the module, with no allowance', () => {
    const from = source({ kind: 'wallet' });
    const calls = buildRepayCalls({
      safe: SAFE,
      module: MODULE,
      moduleEnabled: true,
      source: from,
      quote: quote(from, 50_000_000n),
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe(MODULE);
    expect(decodeModule(calls[0].data)).toEqual({
      functionName: 'repayFromSafe',
      args: [SAFE, SOUSD, 46_258_819n],
    });
  });

  it('closes from collateral with max and returns the rest in the same batch', () => {
    const from = source({ kind: 'collateral' });
    const calls = buildRepayCalls({
      safe: SAFE,
      module: MODULE,
      moduleEnabled: true,
      source: from,
      quote: quote(from, null, true),
    });

    expect(calls.map(call => decodeModule(call.data))).toEqual([
      { functionName: 'repayFromCollateral', args: [SAFE, SOUSD, maxUint256] },
      { functionName: 'withdrawCollateral', args: [SOUSD, maxUint256] },
    ]);
  });

  it('sends a partial collateral repayment in USD', () => {
    const from = source({ kind: 'collateral' });
    const calls = buildRepayCalls({
      safe: SAFE,
      module: MODULE,
      moduleEnabled: true,
      source: from,
      quote: quote(from, 100_000_000n),
    });

    expect(calls.map(call => decodeModule(call.data))).toEqual([
      { functionName: 'repayFromCollateral', args: [SAFE, SOUSD, 100_000_000n] },
    ]);
  });

  it('falls back to an exact allowance and clears it when the module is revoked', () => {
    const from = source({ kind: 'wallet' });
    const calls = buildRepayCalls({
      safe: SAFE,
      module: MODULE,
      moduleEnabled: false,
      source: from,
      quote: quote(from, null, true),
    });

    expect(calls.map(call => call.to)).toEqual([SOUSD, MODULE, SOUSD, MODULE]);
    expect(decodeFunctionData({ abi: erc20Abi, data: calls[0].data })).toEqual({
      functionName: 'approve',
      args: [MODULE, LOOSE],
    });
    expect(decodeModule(calls[1].data)).toEqual({
      functionName: 'repay',
      args: [SAFE, SOUSD, LOOSE],
    });
    expect(decodeFunctionData({ abi: erc20Abi, data: calls[2].data })).toEqual({
      functionName: 'approve',
      args: [MODULE, 0n],
    });
    expect(decodeModule(calls[3].data)).toEqual({
      functionName: 'withdrawCollateral',
      args: [SOUSD, maxUint256],
    });
  });

  it('refuses to build a quote that is not ok', () => {
    const from = source({ kind: 'wallet' });
    expect(() =>
      buildRepayCalls({
        safe: SAFE,
        module: MODULE,
        moduleEnabled: true,
        source: from,
        quote: quote(from, 304_780_000n),
      }),
    ).toThrow('You owe $304.77.');
  });
});

describe('amount text', () => {
  it('keeps digits and one decimal point, two places at most', () => {
    expect(sanitizeUsdAmountText('50.567')).toBe('50.56');
    expect(sanitizeUsdAmountText('1.2.3')).toBe('1.23');
    expect(sanitizeUsdAmountText('abc')).toBe('');
  });

  it('reads a typed comma as the decimal point', () => {
    expect(sanitizeUsdAmountText('12,')).toBe('12.');
    expect(sanitizeUsdAmountText('12,5')).toBe('12.5');
    expect(sanitizeUsdAmountText('12,50')).toBe('12.50');
  });

  it('drops a pasted comma that is grouping, rather than repaying a thousandth', () => {
    expect(sanitizeUsdAmountText('$1,234.56')).toBe('1234.56');
    expect(sanitizeUsdAmountText('1,234')).toBe('1234');
    expect(sanitizeUsdAmountText('1,234,567')).toBe('1234567');
  });

  it('parses to 6-decimal USD', () => {
    expect(parseUsdAmountText('')).toBeNull();
    expect(parseUsdAmountText('.')).toBeNull();
    expect(parseUsdAmountText('50')).toBe(50_000_000n);
    expect(parseUsdAmountText('50.5')).toBe(50_500_000n);
    expect(parseUsdAmountText('.05')).toBe(50_000n);
  });

  it('shows the bridged USDC under the name the app uses for it', () => {
    expect(repayDisplaySymbol('USDC.e')).toBe('USDC');
    expect(repayDisplaySymbol('soUSD')).toBe('soUSD');
    expect(repayDisplaySymbol('USDT')).toBe('USDT');
  });
});
