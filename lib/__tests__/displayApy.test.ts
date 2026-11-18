import {
  apyPeriodText,
  displayApy,
  formatApyPercent,
  isNewVault,
  newVaultApy,
  newVaultChangesAt,
} from '@/lib/displayApy';

import type { APYs } from '@/lib/types';

const NOW = new Date('2026-11-18T12:00:00Z');

// soBTC five days in: every window divides five days' growth by its full length.
const youngVault: APYs = {
  allTime: 1.49,
  oneDay: 2.4,
  sevenDay: 0.63,
  fifteenDay: 0.3,
  thirtyDay: 0.15,
  firstRateAt: '2026-11-13T09:00:00Z',
};

const matureVault: APYs = {
  allTime: 6.54,
  oneDay: 9.1,
  sevenDay: 5.15,
  fifteenDay: 5.83,
  thirtyDay: 5.94,
  firstRateAt: '2025-06-01T00:00:00Z',
};

describe('isNewVault', () => {
  it('is new for the first 15 days of its rate history', () => {
    expect(isNewVault(youngVault, NOW)).toBe(true);
    expect(isNewVault({ ...youngVault, firstRateAt: '2026-11-18T12:00:00Z' }, NOW)).toBe(true);
    expect(isNewVault({ ...youngVault, firstRateAt: '2026-11-03T12:00:01Z' }, NOW)).toBe(true);
  });

  it('is not new when its start is ahead of the device clock', () => {
    expect(isNewVault({ ...youngVault, firstRateAt: '2026-11-18T13:00:00Z' }, NOW)).toBe(false);
    expect(displayApy({ ...youngVault, firstRateAt: '2027-01-01T00:00:00Z' }, NOW)).toEqual({
      apy: 0.63,
      days: 7,
    });
  });

  it('is not new from day 15 on', () => {
    expect(isNewVault({ ...youngVault, firstRateAt: '2026-11-03T12:00:00Z' }, NOW)).toBe(false);
    expect(isNewVault(matureVault, NOW)).toBe(false);
  });

  it('is not new when the API does not say when the vault started', () => {
    expect(isNewVault(undefined, NOW)).toBe(false);
    expect(isNewVault({ ...youngVault, firstRateAt: undefined }, NOW)).toBe(false);
    expect(isNewVault({ ...youngVault, firstRateAt: null }, NOW)).toBe(false);
    expect(isNewVault({ ...youngVault, firstRateAt: 'not a date' }, NOW)).toBe(false);
  });
});

describe('newVaultApy', () => {
  it("is a new vault's trailing day", () => {
    expect(newVaultApy(youngVault, NOW)).toBe(2.4);
  });

  it('is undefined for a mature vault, or a new one whose day earned nothing', () => {
    expect(newVaultApy(matureVault, NOW)).toBeUndefined();
    expect(newVaultApy({ ...youngVault, oneDay: 0 }, NOW)).toBeUndefined();
    expect(newVaultApy({ ...youngVault, oneDay: -0.5 }, NOW)).toBeUndefined();
    expect(newVaultApy({ ...youngVault, oneDay: undefined }, NOW)).toBeUndefined();
  });
});

describe('displayApy', () => {
  it('shows a new vault at its trailing day', () => {
    expect(displayApy(youngVault, NOW)).toEqual({ apy: 2.4, days: 1 });
  });

  it('shows a mature vault at its best window, never its trailing day', () => {
    expect(displayApy(matureVault, NOW)).toEqual({ apy: 5.94, days: 30 });
  });

  it("falls back to the windows when a new vault's day earned nothing", () => {
    expect(displayApy({ ...youngVault, oneDay: 0 }, NOW)).toEqual({ apy: 0.63, days: 7 });
  });

  it('keeps the windows on an API without the trailing day or start', () => {
    const { oneDay: _oneDay, firstRateAt: _firstRateAt, ...olderApi } = youngVault;
    expect(displayApy(olderApi, NOW)).toEqual({ apy: 0.63, days: 7 });
  });

  it('is 0% over 30 days with no positive window', () => {
    expect(displayApy(undefined, NOW)).toEqual({ apy: 0, days: 30 });
    expect(
      displayApy({ allTime: 0, sevenDay: 0, fifteenDay: -1, thirtyDay: 0, firstRateAt: null }, NOW),
    ).toEqual({ apy: 0, days: 30 });
  });
});

describe('newVaultChangesAt', () => {
  it('is the end of the first 15 days while the vault is new', () => {
    expect(newVaultChangesAt(youngVault, NOW)).toBe(Date.parse('2026-11-28T09:00:00Z'));
  });

  it('is the start while that is still ahead of the device clock', () => {
    expect(newVaultChangesAt({ ...youngVault, firstRateAt: '2026-11-18T13:00:00Z' }, NOW)).toBe(
      Date.parse('2026-11-18T13:00:00Z'),
    );
  });

  it('is undefined once it never changes, or without a start', () => {
    expect(newVaultChangesAt(matureVault, NOW)).toBeUndefined();
    expect(newVaultChangesAt({ ...youngVault, firstRateAt: '2026-11-03T12:00:00Z' }, NOW)).toBe(
      undefined,
    );
    expect(newVaultChangesAt({ ...youngVault, firstRateAt: null }, NOW)).toBeUndefined();
    expect(newVaultChangesAt({ ...youngVault, firstRateAt: 'not a date' }, NOW)).toBeUndefined();
    expect(newVaultChangesAt(undefined, NOW)).toBeUndefined();
  });
});

describe('apyPeriodText', () => {
  it('reads a day as 24 hours and anything longer in days', () => {
    expect(apyPeriodText(1)).toBe('24 hours');
    expect(apyPeriodText(15)).toBe('15 days');
  });
});

describe('formatApyPercent', () => {
  it('shows one decimal', () => {
    expect(formatApyPercent(5.94)).toBe('5.9%');
    expect(formatApyPercent(0.63)).toBe('0.6%');
    expect(formatApyPercent(0.05)).toBe('0.1%');
  });

  it('never shows a positive rate as 0.0%', () => {
    expect(formatApyPercent(0.04)).toBe('0.04%');
    expect(formatApyPercent(0.005)).toBe('0.01%');
    expect(formatApyPercent(0.004)).toBe('<0.01%');
  });

  it('still shows a true 0 as 0.0%', () => {
    expect(formatApyPercent(0)).toBe('0.0%');
  });
});
