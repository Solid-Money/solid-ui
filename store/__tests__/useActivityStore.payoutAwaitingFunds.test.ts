/// <reference types="jest" />

import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { isPayoutAwaitingFunds } from '@/lib/utils/payoutAwaitingFunds';
import { useActivityStore } from '@/store/useActivityStore';

// MMKV is a native module — back the persisted store with plain memory here.
// (jest.mock is hoisted above the import by babel-jest.)
jest.mock('@/lib/mmvkStorage', () => {
  const memory = new Map<string, string>();
  return {
    __esModule: true,
    default: () => ({
      setItem: (key: string, value: string) => memory.set(key, value),
      getItem: (key: string) => memory.get(key) ?? null,
      removeItem: (key: string) => memory.delete(key),
    }),
  };
});

/**
 * Wirex reports a bank deposit complete when the euros reach our account, but
 * the user is paid by our EURC transfer after that. When our payout wallet is
 * short, the backend moves the row back to processing, flagged as awaiting
 * funds, and completes it again once the payout lands. The device has usually
 * cached the first "success" by then, and must accept the correction rather
 * than treat it as a stale downgrade.
 */
describe('activity store - a payout waiting on our payout wallet', () => {
  const USER = 'user-1';
  const deposit: ActivityEvent = {
    clientTxId: 'wirex_bank_deposit_ea6fbc2c-b8da-4a7b-99d1-6a2220352d02',
    title: 'Bank deposit',
    timestamp: '1794407053',
    type: TransactionType.WIREX_BANK_DEPOSIT,
    status: TransactionStatus.SUCCESS,
    amount: '2500',
    symbol: 'EUR',
  };
  const awaiting: ActivityEvent = {
    ...deposit,
    status: TransactionStatus.PROCESSING,
    metadata: { payout: { state: 'awaiting_funds', since: '2026-11-15T09:00:00Z' } },
  };

  const stored = () => useActivityStore.getState().events[USER][0];

  afterEach(() => {
    useActivityStore.setState({ events: {} });
  });

  it('takes the correction from complete back to in progress, from a page read', () => {
    useActivityStore.getState().setEvents(USER, [deposit]);

    useActivityStore.getState().bulkUpsertEvent(USER, [awaiting]);

    expect(stored().status).toBe(TransactionStatus.PROCESSING);
    expect(isPayoutAwaitingFunds(stored().metadata)).toBe(true);
  });

  it('takes the same correction from a single upsert', () => {
    useActivityStore.getState().setEvents(USER, [deposit]);

    useActivityStore.getState().upsertEvent(USER, awaiting);

    expect(stored().status).toBe(TransactionStatus.PROCESSING);
  });

  it('completes it again once the payout lands', () => {
    useActivityStore.getState().setEvents(USER, [awaiting]);

    useActivityStore.getState().bulkUpsertEvent(USER, [{ ...deposit, metadata: {} }]);

    expect(stored().status).toBe(TransactionStatus.SUCCESS);
    expect(isPayoutAwaitingFunds(stored().metadata)).toBe(false);
  });

  it('still refuses any other downgrade from success', () => {
    useActivityStore.getState().setEvents(USER, [deposit]);

    useActivityStore
      .getState()
      .bulkUpsertEvent(USER, [{ ...deposit, status: TransactionStatus.PROCESSING }]);

    expect(stored().status).toBe(TransactionStatus.SUCCESS);
  });
});

describe('isPayoutAwaitingFunds', () => {
  it('reads only the backend flag', () => {
    expect(isPayoutAwaitingFunds({ payout: { state: 'awaiting_funds' } })).toBe(true);
    expect(isPayoutAwaitingFunds({ payout: { state: 'sent' } })).toBe(false);
    expect(isPayoutAwaitingFunds({ payout: 'awaiting_funds' })).toBe(false);
    expect(isPayoutAwaitingFunds({})).toBe(false);
    expect(isPayoutAwaitingFunds(undefined)).toBe(false);
    expect(isPayoutAwaitingFunds(null)).toBe(false);
  });
});
