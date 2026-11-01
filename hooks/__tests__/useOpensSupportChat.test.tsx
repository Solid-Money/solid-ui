import React from 'react';

import { useOpensSupportChat } from '@/hooks/useSupportChat';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let mockAccess = { hasFeature: false, ready: false, isError: false, retry: jest.fn() };
let mockConfigured = true;

jest.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => mockAccess,
  useHasFeature: () => mockAccess.hasFeature,
}));
jest.mock('@/lib/api/support', () => ({ isSupportChatConfigured: () => mockConfigured }));
jest.mock('@/lib/support/sync', () => ({
  loadThread: jest.fn(),
  markRead: jest.fn(),
  syncThread: jest.fn(),
}));
jest.mock('@/lib/support/focus', () => ({ setSupportChatFocused: jest.fn() }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/store/useUserStore', () => ({ useUserStore: jest.fn() }));
jest.mock('@/store/useSupportChatStore', () => ({ useSupportChatStore: jest.fn() }));

/** Render the hook and return its value. */
const opens = async (): Promise<boolean> => {
  const seen: boolean[] = [];
  const Probe = () => {
    seen.push(useOpensSupportChat());
    return null;
  };
  await act(async () => {
    create(<Probe />);
  });
  return seen[seen.length - 1];
};

describe('useOpensSupportChat', () => {
  beforeEach(() => {
    mockConfigured = true;
  });

  it('opens the in-house chat while the answer is still loading', async () => {
    mockAccess = { hasFeature: false, ready: false, isError: false, retry: jest.fn() };
    expect(await opens()).toBe(true);
  });

  it('opens the in-house chat when the check failed, so the screen can offer a retry', async () => {
    mockAccess = { hasFeature: false, ready: true, isError: true, retry: jest.fn() };
    expect(await opens()).toBe(true);
  });

  it('opens the in-house chat when the user has it', async () => {
    mockAccess = { hasFeature: true, ready: true, isError: false, retry: jest.fn() };
    expect(await opens()).toBe(true);
  });

  it('keeps Intercom only on a definite no', async () => {
    mockAccess = { hasFeature: false, ready: true, isError: false, retry: jest.fn() };
    expect(await opens()).toBe(false);
  });

  it('keeps Intercom when no support API is configured', async () => {
    mockConfigured = false;
    mockAccess = { hasFeature: true, ready: true, isError: false, retry: jest.fn() };
    expect(await opens()).toBe(false);
  });
});
