import {
  aiApiLimitProgress,
  formatAiApiCashback,
  formatAiApiDay,
  formatAiApiLastUsed,
  formatAiApiLimit,
  formatAiApiLongDate,
  formatAiApiPaidFrom,
  formatAiApiRate,
  formatAiApiShortDate,
  formatAiApiTokens,
  formatAiApiUsd,
  maskAiApiKey,
} from '@/components/AiApi/aiApiFormat';

describe('formatAiApiUsd', () => {
  it.each([
    [42.8, '$42.80'],
    [0.5, '$0.50'],
    [0, '$0.00'],
    [1234.567, '$1,234.57'],
    [-3, '$0.00'],
    [Number.NaN, '$0.00'],
  ])('formats %p as %s', (value, expected) => {
    expect(formatAiApiUsd(value)).toBe(expected);
  });

  it('marks cashback as money coming back', () => {
    expect(formatAiApiCashback(21.4)).toBe('+$21.40');
  });
});

describe('formatAiApiLimit', () => {
  it('shows limits in whole dollars', () => {
    expect(formatAiApiLimit(50)).toBe('$50');
    expect(formatAiApiLimit(1000)).toBe('$1,000');
  });
});

describe('formatAiApiRate', () => {
  it.each([
    [0.5, '50%'],
    [0.125, '12.5%'],
    [0, '0%'],
  ])('formats a rate of %p as %s', (rate, expected) => {
    expect(formatAiApiRate(rate)).toBe(expected);
  });
});

describe('formatAiApiTokens', () => {
  it.each([
    [1_200_000, '1.2M tokens'],
    [840_000, '840K tokens'],
    [312, '312 tokens'],
  ])('formats %p as %s', (tokens, expected) => {
    expect(formatAiApiTokens(tokens)).toBe(expected);
  });
});

describe('dates', () => {
  it('reads dates as UTC days, the way the backend keys them', () => {
    expect(formatAiApiShortDate('2026-11-01T00:00:00.000Z')).toBe('Nov 1');
    expect(formatAiApiLongDate('2026-10-14T23:30:00.000Z')).toBe('Oct 14, 2026');
    expect(formatAiApiDay('2026-10-14')).toBe('Oct 14');
  });

  it('says how long ago a key was last used', () => {
    const now = new Date('2026-10-25T12:00:00.000Z');
    expect(formatAiApiLastUsed(null, now)).toBe('never');
    expect(formatAiApiLastUsed('2026-10-25T11:59:30.000Z', now)).toBe('just now');
    expect(formatAiApiLastUsed('2026-10-25T11:58:00.000Z', now)).toBe('2 min ago');
    expect(formatAiApiLastUsed('2026-10-25T09:00:00.000Z', now)).toBe('3 h ago');
    expect(formatAiApiLastUsed('2026-10-24T08:00:00.000Z', now)).toBe('yesterday');
    expect(formatAiApiLastUsed('2026-10-03T08:00:00.000Z', now)).toBe('Oct 3');
  });
});

describe('keys and limits', () => {
  it('never shows more of a key than its last four', () => {
    expect(maskAiApiKey('4f2a')).toBe('…4f2a');
  });

  it('clamps limit progress to the bar', () => {
    expect(aiApiLimitProgress(25, 50)).toBe(0.5);
    expect(aiApiLimitProgress(80, 50)).toBe(1);
    expect(aiApiLimitProgress(5, 0)).toBe(0);
  });
});

describe('formatAiApiPaidFrom', () => {
  it('names the billing tokens in the order a charge draws them', () => {
    expect(formatAiApiPaidFrom(['USDC'])).toBe('USDC');
    expect(formatAiApiPaidFrom(['USDC', 'soUSD'])).toBe('USDC, then soUSD');
    expect(formatAiApiPaidFrom(['USDC', 'USDT', 'soUSD'])).toBe('USDC, USDT, then soUSD');
  });

  it('falls back to the Wallet when the list could not be read', () => {
    expect(formatAiApiPaidFrom([])).toBe('Your Wallet');
  });
});
