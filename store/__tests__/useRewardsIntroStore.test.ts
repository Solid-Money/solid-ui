/// <reference types="jest" />

import { useRewardsIntroStore } from '@/store/useRewardsIntroStore';

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

describe('rewards intro completion', () => {
  afterEach(() => {
    useRewardsIntroStore.setState({ completedByUserId: {} });
  });

  it('starts incomplete and marks the selected account complete', () => {
    expect(useRewardsIntroStore.getState().completedByUserId['user-a']).toBeUndefined();

    useRewardsIntroStore.getState().complete('user-a');

    expect(useRewardsIntroStore.getState().completedByUserId['user-a']).toBe(true);
  });

  it('tracks completion independently for each account', () => {
    useRewardsIntroStore.getState().complete('user-a');

    const { completedByUserId } = useRewardsIntroStore.getState();
    expect(completedByUserId['user-a']).toBe(true);
    expect(completedByUserId['user-b']).toBeUndefined();
  });
});
