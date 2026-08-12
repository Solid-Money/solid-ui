/// <reference types="jest" />

import { useKycStore } from '@/store/useKycStore';

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

describe('kyc started marker', () => {
  afterEach(() => {
    useKycStore.setState({ kycStartedAt: {} });
  });

  it('records nothing until the user opens verification', () => {
    expect(useKycStore.getState().kycStartedAt['user-1']).toBeUndefined();
  });

  it('keeps the first timestamp when verification is reopened', () => {
    const { markKycStarted } = useKycStore.getState();

    markKycStarted('user-1');
    const first = useKycStore.getState().kycStartedAt['user-1'];
    markKycStarted('user-1');

    expect(first).toEqual(expect.any(Number));
    expect(useKycStore.getState().kycStartedAt['user-1']).toBe(first);
  });

  it('does not leak the marker to another account on the same device', () => {
    useKycStore.getState().markKycStarted('user-1');

    expect(useKycStore.getState().kycStartedAt['user-2']).toBeUndefined();
  });

  it('clears one account without touching the others', () => {
    const { markKycStarted, clearKycStartedAt } = useKycStore.getState();
    markKycStarted('user-1');
    markKycStarted('user-2');

    clearKycStartedAt('user-1');

    expect(useKycStore.getState().kycStartedAt['user-1']).toBeUndefined();
    expect(useKycStore.getState().kycStartedAt['user-2']).toEqual(expect.any(Number));
  });
});
