/// <reference types="jest" />

import { VaultType } from '@/lib/types';

import type * as HomeSnapshotModule from '@/lib/homeSnapshot';

const mockDisk = new Map<string, string>();

jest.mock('@/lib/mmvkStorage', () => (id: string) => ({
  getItem: (key: string) => mockDisk.get(`${id}:${key}`) ?? null,
  setItem: (key: string, value: string) => mockDisk.set(`${id}:${key}`, value),
  removeItem: (key: string) => mockDisk.delete(`${id}:${key}`),
}));

const DISK_KEY = 'home-snapshot:last';

/** A fresh copy of the module and the store it reads, so no test sees another's memory. */
const load = () => {
  let snapshot!: typeof HomeSnapshotModule;
  let store!: typeof import('@/store/useUserStore');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    store = require('@/store/useUserStore');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    snapshot = require('@/lib/homeSnapshot');
  });
  const signIn = (userId: string | null) =>
    store.useUserStore.setState({
      users: userId ? [{ userId, username: 'mark', selected: true } as never] : [],
    });
  return { ...snapshot, signIn };
};

const INPUT = {
  userId: 'u1',
  balance: { amount: 5_142.84, symbol: '$' },
  hasFunds: true,
  hasCard: true,
  assets: [
    {
      key: 'earn:USDC',
      title: 'USD Yield',
      value: 3_468.33,
      apy: 4.2,
      icon: { type: 'yield' as const, vaultType: VaultType.USDC },
      href: { pathname: '/savings', params: { vault: VaultType.USDC } } as never,
    },
    {
      key: 'cash:usdc',
      title: 'USDC',
      value: 9.99,
      subtitle: '9.99 USDC',
      icon: { type: 'token' as const, symbol: 'USDC', logoUrl: 'https://example.com/usdc.png' },
      href: '/coins/8453-0xabc' as never,
    },
  ],
};

beforeEach(() => {
  jest.useFakeTimers();
  mockDisk.clear();
});
afterEach(() => jest.useRealTimers());

describe('home snapshot', () => {
  it('draws back what was saved, for the same user only', () => {
    const { saveHomeSnapshot, readHomeSnapshot } = load();
    saveHomeSnapshot(INPUT);

    const restored = load().readHomeSnapshot('u1');
    expect(restored).toMatchObject({ ...INPUT, version: 1 });
    expect(restored?.savedAt).toBe(Date.now());
    expect(readHomeSnapshot('u2')).toBeNull();
    expect(readHomeSnapshot(undefined)).toBeNull();
  });

  it('shows nothing older than a week', () => {
    load().saveHomeSnapshot(INPUT);
    jest.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(load().readHomeSnapshot('u1')).toBeNull();
  });

  it('drops a copy it cannot read instead of drawing it', () => {
    mockDisk.set(DISK_KEY, JSON.stringify({ version: 1, userId: 'u1', balance: { amount: 'x' } }));
    expect(load().readHomeSnapshot('u1')).toBeNull();
    expect(mockDisk.has(DISK_KEY)).toBe(false);

    mockDisk.set(DISK_KEY, '{not json');
    expect(load().readHomeSnapshot('u1')).toBeNull();
  });

  it('leaves out figures JSON cannot carry rather than refusing the whole snapshot', () => {
    const { saveHomeSnapshot } = load();
    saveHomeSnapshot({
      ...INPUT,
      assets: [{ ...INPUT.assets[0], value: Number.NaN, apy: Number.POSITIVE_INFINITY }],
    });
    const restored = load().readHomeSnapshot('u1');
    expect(restored?.assets[0].value).toBeUndefined();
    expect(restored?.assets[0].apy).toBeUndefined();
  });

  it('never saves a balance that is not a number', () => {
    load().saveHomeSnapshot({ ...INPUT, balance: { amount: Number.NaN, symbol: '$' } });
    expect(mockDisk.has(DISK_KEY)).toBe(false);
  });

  it('skips rewriting figures that did not change, but refreshes their age now and then', () => {
    const { saveHomeSnapshot, readHomeSnapshot } = load();
    saveHomeSnapshot(INPUT);
    const first = readHomeSnapshot('u1')?.savedAt;

    jest.advanceTimersByTime(10_000);
    saveHomeSnapshot(INPUT);
    expect(readHomeSnapshot('u1')?.savedAt).toBe(first);

    jest.advanceTimersByTime(60_000);
    saveHomeSnapshot(INPUT);
    expect(readHomeSnapshot('u1')?.savedAt).toBe(Date.now());
  });

  it('forgets the figures as soon as the account changes', () => {
    const { signIn, saveHomeSnapshot, guardHomeSnapshotOwner, readHomeSnapshot } = load();
    signIn('u1');
    const stop = guardHomeSnapshotOwner();
    saveHomeSnapshot(INPUT);
    expect(readHomeSnapshot('u1')).not.toBeNull();

    signIn(null);
    expect(readHomeSnapshot('u1')).toBeNull();
    expect(mockDisk.has(DISK_KEY)).toBe(false);
    stop();
  });
});
