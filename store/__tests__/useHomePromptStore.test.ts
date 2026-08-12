/// <reference types="jest" />

import {
  HOME_PROMPT_SNOOZE_MS,
  isHomePromptSnoozed,
  useHomePromptStore,
} from '@/store/useHomePromptStore';

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

const DAY_MS = 24 * 60 * 60 * 1000;

describe('home prompt snoozing', () => {
  afterEach(() => {
    useHomePromptStore.setState({ dismissedAt: {} });
  });

  it('shows a prompt that was never dismissed', () => {
    expect(isHomePromptSnoozed({}, 'verification')).toBe(false);
  });

  it('hides a prompt for the snooze window, then brings it back', () => {
    const now = 1_700_000_000_000;
    const dismissedAt = { fund: now };
    const window = HOME_PROMPT_SNOOZE_MS.fund;

    expect(isHomePromptSnoozed(dismissedAt, 'fund', now + 1000)).toBe(true);
    expect(isHomePromptSnoozed(dismissedAt, 'fund', now + window - 1)).toBe(true);
    expect(isHomePromptSnoozed(dismissedAt, 'fund', now + window)).toBe(false);
  });

  it('brings the verification prompt back a week after it was closed', () => {
    const now = 1_700_000_000_000;
    const dismissedAt = { verification: now };

    expect(HOME_PROMPT_SNOOZE_MS.verification).toBe(7 * DAY_MS);
    expect(isHomePromptSnoozed(dismissedAt, 'verification', now + 6 * DAY_MS)).toBe(true);
    expect(isHomePromptSnoozed(dismissedAt, 'verification', now + 7 * DAY_MS)).toBe(false);
  });

  it('snoozes each variant independently', () => {
    useHomePromptStore.getState().dismiss('fund');
    const { dismissedAt } = useHomePromptStore.getState();

    expect(isHomePromptSnoozed(dismissedAt, 'fund')).toBe(true);
    expect(isHomePromptSnoozed(dismissedAt, 'apple-pay')).toBe(false);
  });

  it('does not hide forever when the device clock moves backwards', () => {
    const now = 1_700_000_000_000;

    expect(isHomePromptSnoozed({ fund: now }, 'fund', now - 60_000)).toBe(false);
  });
});
