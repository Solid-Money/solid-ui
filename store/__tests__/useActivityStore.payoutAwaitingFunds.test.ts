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

  it('ignores an older awaiting-funds copy that lands after the payout completed', () => {
    // A slow page read from before the payout went out arrives last.
    useActivityStore
      .getState()
      .setEvents(USER, [{ ...deposit, updatedAt: '2026-11-15T10:05:00.000Z' }]);

    useActivityStore
      .getState()
      .bulkUpsertEvent(USER, [{ ...awaiting, updatedAt: '2026-11-15T09:00:00.000Z' }]);

    expect(stored().status).toBe(TransactionStatus.SUCCESS);
    expect(isPayoutAwaitingFunds(stored().metadata)).toBe(false);
  });

  it('stays complete when an older awaiting copy that also changes another field is replayed', () => {
    // The older copy differs in its hash, so it is merged; it must not carry
    // back its older timestamp or flag, or the replay would look current.
    const completed = { ...deposit, updatedAt: '2026-11-15T10:05:00.000Z' };
    const stale = {
      ...awaiting,
      hash: '0xolder',
      updatedAt: '2026-11-15T09:00:00.000Z',
    };

    for (const write of [
      (event: ActivityEvent) => useActivityStore.getState().bulkUpsertEvent(USER, [event]),
      (event: ActivityEvent) => useActivityStore.getState().upsertEvent(USER, event),
    ]) {
      useActivityStore.getState().setEvents(USER, [completed]);

      write(stale);
      write(stale);

      expect(stored().status).toBe(TransactionStatus.SUCCESS);
      expect(stored().updatedAt).toBe(completed.updatedAt);
      expect(isPayoutAwaitingFunds(stored().metadata)).toBe(false);
    }
  });

  it('orders against the newest copy seen, even one that changed nothing else', () => {
    // T1 success, then T3 success with nothing else different, then a delayed
    // awaiting copy from T2: it is older than what the device has seen.
    const t1 = { ...deposit, updatedAt: '2026-11-15T09:00:00.000Z' };
    const t3 = { ...deposit, updatedAt: '2026-11-15T09:30:00.000Z' };
    const t2 = { ...awaiting, updatedAt: '2026-11-15T09:15:00.000Z' };

    for (const write of [
      (event: ActivityEvent) => useActivityStore.getState().bulkUpsertEvent(USER, [event]),
      (event: ActivityEvent) => useActivityStore.getState().upsertEvent(USER, event),
    ]) {
      useActivityStore.getState().setEvents(USER, [t1]);

      write(t3);
      write(t2);

      expect(stored().status).toBe(TransactionStatus.SUCCESS);
      expect(stored().updatedAt).toBe(t3.updatedAt);
    }
  });

  it('refuses an awaiting copy with no updatedAt against a stored one that has it', () => {
    useActivityStore
      .getState()
      .setEvents(USER, [{ ...deposit, updatedAt: '2026-11-15T09:00:00.000Z' }]);

    useActivityStore.getState().bulkUpsertEvent(USER, [awaiting]);

    expect(stored().status).toBe(TransactionStatus.SUCCESS);
  });

  it('keeps the stored updatedAt when an awaiting copy carries an unreadable one', () => {
    // The flag alone makes the first copy a change, so it is merged. Its
    // unreadable timestamp must not replace the stored one, or the replay
    // would have nothing to be ordered against and would downgrade the row.
    const completed = { ...deposit, updatedAt: '2026-11-15T10:05:00.000Z' };

    for (const updatedAt of ['invalid', '']) {
      const unreadable = { ...awaiting, updatedAt };
      for (const write of [
        (event: ActivityEvent) => useActivityStore.getState().bulkUpsertEvent(USER, [event]),
        (event: ActivityEvent) => useActivityStore.getState().upsertEvent(USER, event),
      ]) {
        useActivityStore.getState().setEvents(USER, [completed]);

        write(unreadable);
        write(unreadable);

        expect(stored().status).toBe(TransactionStatus.SUCCESS);
        expect(stored().updatedAt).toBe(completed.updatedAt);
      }
    }
  });

  it('takes a newer awaiting-funds copy over a success', () => {
    useActivityStore
      .getState()
      .setEvents(USER, [{ ...deposit, updatedAt: '2026-11-15T09:00:00.000Z' }]);

    useActivityStore
      .getState()
      .upsertEvent(USER, { ...awaiting, updatedAt: '2026-11-15T09:01:00.000Z' });

    expect(stored().status).toBe(TransactionStatus.PROCESSING);
  });

  it('stores the flag when it arrives on a row already in progress', () => {
    // Same status both sides: the flag alone is the change, and must not be
    // dropped as "nothing changed".
    useActivityStore
      .getState()
      .setEvents(USER, [{ ...deposit, status: TransactionStatus.PROCESSING }]);

    useActivityStore.getState().bulkUpsertEvent(USER, [awaiting]);

    expect(isPayoutAwaitingFunds(stored().metadata)).toBe(true);
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
