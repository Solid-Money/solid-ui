/// <reference types="jest" />

import { ReadBudgetExceededError, withBudget, withinBudgetOr } from '@/lib/readBudget';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('withBudget', () => {
  it('passes through what finishes in time', async () => {
    await expect(withBudget(Promise.resolve(42), 1_000)).resolves.toBe(42);
  });

  it('passes through a failure that comes in time', async () => {
    await expect(withBudget(Promise.reject(new Error('boom')), 1_000)).rejects.toThrow('boom');
  });

  it('gives up on what takes longer than the budget', async () => {
    const result = withBudget(new Promise(() => {}), 1_000);
    const settled = expect(result).rejects.toBeInstanceOf(ReadBudgetExceededError);
    await jest.advanceTimersByTimeAsync(1_000);
    await settled;
  });
});

describe('withinBudgetOr', () => {
  it('stands in the fallback when the budget runs out', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = withinBudgetOr(new Promise<number>(() => {}), 500, 0);
    await jest.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toBe(0);
    warn.mockRestore();
  });

  it('still surfaces a real failure', async () => {
    await expect(withinBudgetOr(Promise.reject(new Error('down')), 500, 0)).rejects.toThrow('down');
  });
});
