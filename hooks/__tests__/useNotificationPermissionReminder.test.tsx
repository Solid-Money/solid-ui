import React from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  NOTIFICATION_REMINDER_INTERVAL_MS,
  useNotificationPermissionReminder,
} from '@/hooks/useNotificationPermissionReminder';
import { useOnboardingStore } from '@/store/useOnboardingStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/mmvkStorage', () => {
  const storage = new Map<string, string>();
  return {
    __esModule: true,
    storage,
    default: () => ({
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    }),
  };
});
const mockStorage = jest.requireMock('@/lib/mmvkStorage').storage as Map<string, string>;
jest.mock('expo-notifications', () => ({ getPermissionsAsync: jest.fn() }));

const NOW = 1_800_000_000_000;
const permissions = Notifications.getPermissionsAsync as jest.Mock;
const originalOS = Platform.OS;
const listeners = new Set<(state: AppStateStatus) => void>();
type Result = ReturnType<typeof useNotificationPermissionReminder>;

describe('notification reminder cooldown', () => {
  let renderer: ReturnType<typeof create> | undefined;
  const results: Result[] = [];
  const Probe = ({ enabled }: { enabled: boolean }) => {
    const result = useNotificationPermissionReminder(enabled);
    React.useEffect(() => {
      results.push(result);
    });
    return null;
  };
  const latest = () => results[results.length - 1];
  const mount = async (enabled = true) => {
    await act(async () => {
      renderer = create(<Probe enabled={enabled} />);
    });
  };
  const foreground = async () => {
    await act(async () => {
      Object.assign(AppState, { currentState: 'active' });
      listeners.forEach(listener => listener('active'));
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    results.length = 0;
    mockStorage.clear();
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    Object.assign(AppState, { currentState: 'active' });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    });
    useOnboardingStore.setState({
      hasSeenOnboarding: true,
      hasSeenNotificationOnboarding: true,
      lastNotificationPromptAt: NOW - NOTIFICATION_REMINDER_INTERVAL_MS,
    });
    permissions.mockReset().mockResolvedValue({ status: 'undetermined', granted: false });
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = undefined;
    listeners.clear();
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    jest.useRealTimers();
  });

  it('shows on day 30 after Home settles, without requesting OS permission', async () => {
    await mount();
    act(() => jest.advanceTimersByTime(4999));
    expect(latest().visible).toBe(false);
    act(() => jest.advanceTimersByTime(1));
    expect(latest().visible).toBe(true);
    expect(useOnboardingStore.getState().lastNotificationPromptAt).toBe(NOW + 5000);
  });

  it('stays hidden until the full 30 days have elapsed and rechecks on foreground', async () => {
    useOnboardingStore.setState({
      lastNotificationPromptAt: NOW - NOTIFICATION_REMINDER_INTERVAL_MS + 1,
    });
    await mount();
    expect(permissions).not.toHaveBeenCalled();
    jest.setSystemTime(NOW + 1);
    await foreground();
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(true);
  });

  it('starts another 30-day window on dismissal and preserves it across remounts', async () => {
    await mount();
    act(() => jest.advanceTimersByTime(5000));
    jest.setSystemTime(NOW + 60_000);
    act(() => latest().dismiss());
    expect(latest().visible).toBe(false);
    const dismissedAt = NOW + 60_000;
    expect(useOnboardingStore.getState().lastNotificationPromptAt).toBe(dismissedAt);
    act(() => renderer.unmount());
    await mount();
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(false);
    jest.setSystemTime(dismissedAt + NOTIFICATION_REMINDER_INTERVAL_MS);
    await foreground();
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(true);
  });

  it('prompts legacy OTA installs on their first Home visit and preserves onboarding flags', async () => {
    useOnboardingStore.setState({ lastNotificationPromptAt: null });
    mockStorage.set(
      'onboarding-storage',
      JSON.stringify({
        state: { hasSeenOnboarding: true, hasSeenNotificationOnboarding: true },
        version: 0,
      }),
    );
    await useOnboardingStore.persist.rehydrate();
    await mount();
    expect(useOnboardingStore.getState()).toMatchObject({
      hasSeenOnboarding: true,
      hasSeenNotificationOnboarding: true,
      lastNotificationPromptAt: null,
    });
    expect(permissions).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(true);
    const persisted = JSON.parse(mockStorage.get('onboarding-storage')!);
    expect(persisted.state.lastNotificationPromptAt).toBe(NOW + 5000);
    act(() => latest().dismiss());
    act(() => renderer.unmount());
    await mount();
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(false);
  });

  it('does not interrupt users who already granted permission', async () => {
    permissions.mockResolvedValue({ status: 'granted', granted: true });
    await mount();
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(false);
  });

  it('skips the first OTA reminder when notifications are already enabled', async () => {
    useOnboardingStore.setState({ lastNotificationPromptAt: null });
    permissions.mockResolvedValue({ status: 'granted', granted: true });
    await mount();
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(false);
    expect(useOnboardingStore.getState().lastNotificationPromptAt).toBeNull();
  });

  it('can remind a user with denied permission without issuing a system request', async () => {
    permissions.mockResolvedValue({ status: 'denied', granted: false });
    await mount();
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(true);
  });

  it('waits when Home is not ready or another screen or modal is open', async () => {
    await mount(false);
    act(() => jest.advanceTimersByTime(10000));
    expect(permissions).not.toHaveBeenCalled();
    await act(async () => renderer.update(<Probe enabled />));
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(true);
  });

  it('cancels a queued reminder when the user leaves Home', async () => {
    await mount();
    await act(async () => renderer.update(<Probe enabled={false} />));
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(false);
    expect(useOnboardingStore.getState().lastNotificationPromptAt).toBe(
      NOW - NOTIFICATION_REMINDER_INTERVAL_MS,
    );
  });

  it('keeps a presented reminder snoozed after leaving and returning to Home', async () => {
    await mount();
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(true);
    await act(async () => renderer.update(<Probe enabled={false} />));
    await act(async () => renderer.update(<Probe enabled />));
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(false);
  });

  it('ignores stale permission reads after a foreground transition', async () => {
    let resolve!: (permission: unknown) => void;
    permissions.mockReturnValueOnce(
      new Promise(res => {
        resolve = res;
      }),
    );
    await mount();
    await act(async () => {
      Object.assign(AppState, { currentState: 'background' });
      listeners.forEach(listener => listener('background'));
    });
    permissions.mockResolvedValue({ status: 'granted', granted: true });
    await foreground();
    await act(async () => resolve({ status: 'denied', granted: false }));
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(false);
  });

  it('skips reminders when permission cannot be read', async () => {
    permissions.mockRejectedValue(new Error('unavailable'));
    await mount();
    act(() => jest.advanceTimersByTime(5000));
    expect(latest().visible).toBe(false);
  });

  it('does not check permissions or start the cooldown on web', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    useOnboardingStore.setState({ lastNotificationPromptAt: null });
    await mount();
    act(() => jest.advanceTimersByTime(5000));
    expect(permissions).not.toHaveBeenCalled();
    expect(latest().visible).toBe(false);
    expect(useOnboardingStore.getState().lastNotificationPromptAt).toBeNull();
  });
});
