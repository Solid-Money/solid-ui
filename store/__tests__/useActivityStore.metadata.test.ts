/// <reference types="jest" />

import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
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

const USER = 'user-1';

const deposit = (metadata: Record<string, unknown>, overrides: Partial<ActivityEvent> = {}) =>
  ({
    clientTxId: 'deposit-1',
    title: 'Deposit USDC',
    timestamp: '1792584000',
    type: TransactionType.DEPOSIT,
    status: TransactionStatus.PROCESSING,
    amount: '100',
    symbol: 'USDC',
    metadata: { vaultShareSymbol: 'soUSD', ...metadata },
    ...overrides,
  }) as ActivityEvent;

const stored = () => useActivityStore.getState().events[USER]?.[0];

beforeEach(() => {
  useActivityStore.setState({ events: {} });
  useActivityStore.getState().upsertEvent(USER, deposit({ depositStep: 'confirmed' }));
});

/**
 * A deposit's status can stay put while its metadata moves on: the hook records a failed
 * backend call on a row that stays PROCESSING, and the backend writes the deposit step after
 * the status. Earn reads both, so they must land even with nothing else changing.
 */
describe('metadata-only activity updates', () => {
  it('lands a depositError on a row whose status did not change', () => {
    useActivityStore.getState().upsertEvent(USER, deposit({ depositError: 'timeout' }));
    expect(stored()?.metadata?.depositError).toBe('timeout');
  });

  it('lands the complete step after the status, from the realtime stream too', () => {
    // The backend writes SUCCESS first (here, the monitor's early one from the approve
    // receipt) and the step on its own afterwards.
    const success = { status: TransactionStatus.SUCCESS };
    useActivityStore
      .getState()
      .bulkUpsertEvent(USER, [deposit({ depositStep: 'confirmed' }, success)]);
    useActivityStore
      .getState()
      .bulkUpsertEvent(USER, [deposit({ depositStep: 'complete' }, success)]);
    expect(stored()?.status).toBe(TransactionStatus.SUCCESS);
    expect(stored()?.metadata?.depositStep).toBe('complete');
  });

  it('keeps the step when a stale page of history brings an earlier one', () => {
    useActivityStore.getState().upsertEvent(USER, deposit({ depositStep: 'depositing' }));
    useActivityStore.getState().bulkUpsertEvent(USER, [deposit({ depositStep: 'received' })]);
    expect(stored()?.metadata?.depositStep).toBe('depositing');
  });

  it('still ignores other metadata-only changes', () => {
    useActivityStore.getState().upsertEvent(USER, deposit({ depositStep: 'confirmed', note: 'x' }));
    expect(stored()?.metadata?.note).toBeUndefined();
  });
});
