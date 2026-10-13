/// <reference types="jest" />

import { useSupportIntroStore } from '@/store/useSupportIntroStore';

// MMKV is a native module — back the persisted store with plain memory here.
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

describe('support intro', () => {
  afterEach(() => useSupportIntroStore.setState({ seenByUserId: {} }));

  it('is shown once per account', () => {
    expect(useSupportIntroStore.getState().seenByUserId['user-a']).toBeUndefined();
    useSupportIntroStore.getState().markSeen('user-a');
    const { seenByUserId } = useSupportIntroStore.getState();
    expect(seenByUserId['user-a']).toBe(true);
    expect(seenByUserId['user-b']).toBeUndefined();
  });
});
