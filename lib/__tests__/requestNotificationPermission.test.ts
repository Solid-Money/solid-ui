import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';

import { registerForPushNotificationsAsync } from '@/lib/registerForPushNotifications';
import { requestNotificationPermissionOrOpenSettings } from '@/lib/requestNotificationPermission';

jest.mock('expo-notifications', () => ({ getPermissionsAsync: jest.fn() }));
jest.mock('expo-application', () => ({ applicationId: 'xyz.solid.android' }));
jest.mock('expo-intent-launcher', () => ({
  ActivityAction: { APP_NOTIFICATION_SETTINGS: 'notification-settings' },
  startActivityAsync: jest.fn(),
}));
jest.mock('@/lib/registerForPushNotifications', () => ({
  registerForPushNotificationsAsync: jest.fn(),
}));

const originalOS = Platform.OS;

describe('notification reminder action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  it('requests permission when the user has never answered', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    await requestNotificationPermissionOrOpenSettings();
    expect(registerForPushNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('opens iOS Settings after denial instead of requesting permission again', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await requestNotificationPermissionOrOpenSettings();
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(registerForPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('opens the app notification settings on Android after denial', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    await requestNotificationPermissionOrOpenSettings();
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith('notification-settings', {
      extra: { 'android.provider.extra.APP_PACKAGE': 'xyz.solid.android' },
    });
    expect(registerForPushNotificationsAsync).not.toHaveBeenCalled();
  });
});
