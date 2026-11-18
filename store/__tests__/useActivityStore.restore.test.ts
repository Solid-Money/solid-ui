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

/**
 * A send the server hid as spam by mistake reaches the device as a `deleted`
 * event and is marked deleted here. Support can put it back (solid-backend's
 * admin restore of wrongly hidden activity), which republishes the row as
 * `created` with `deleted: false`; a later page read returns it the same way.
 * Either must bring the row back: nothing else ever clears the local flag.
 */
describe('activity store - a row the server restores', () => {
  const USER = 'user-1';
  const send: ActivityEvent = {
    clientTxId: '0x8fc0cd44c26dd294a1a7910aa898728405c5f0bb5e7e5425a7a38e3ffbf3f1d7',
    title: 'Send 100000 soFUSE',
    timestamp: '1794407053',
    type: TransactionType.SEND,
    status: TransactionStatus.PROCESSING,
    amount: '100000',
    symbol: 'SOFUSE',
    chainId: 122,
  };

  const hiddenLocally = () => {
    const store = useActivityStore.getState();
    store.setEvents(USER, [send]);
    store.markDeleted(USER, send.clientTxId, new Date('2026-11-11T14:24:14.309Z'));
    expect(useActivityStore.getState().events[USER][0].deleted).toBe(true);
  };

  afterEach(() => {
    useActivityStore.setState({ events: {} });
  });

  it('shows it again when the realtime batch carries it live', () => {
    hiddenLocally();

    useActivityStore.getState().bulkUpsertEvent(USER, [
      {
        ...send,
        status: TransactionStatus.SUCCESS,
        hash: '0x07114b9b8bc827c3eada08b07f2bab1d76c1f5e86f37730109c0b48de2e76fac',
        deleted: false,
      },
    ]);

    const [row] = useActivityStore.getState().events[USER];
    expect(row.deleted).toBe(false);
    expect(row.status).toBe(TransactionStatus.SUCCESS);
  });

  it('shows it again when a single upsert carries it live', () => {
    hiddenLocally();

    useActivityStore.getState().upsertEvent(USER, { ...send, deleted: false });

    expect(useActivityStore.getState().events[USER][0].deleted).toBe(false);
  });

  it('leaves it hidden when an update does not say it is live', () => {
    hiddenLocally();

    // A partial update with no `deleted` field is not a restore.
    useActivityStore
      .getState()
      .bulkUpsertEvent(USER, [{ ...send, status: TransactionStatus.SUCCESS }]);

    expect(useActivityStore.getState().events[USER][0].deleted).toBe(true);
  });
});
