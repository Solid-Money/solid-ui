import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';

import { registerForPushNotificationsAsync } from '@/lib/registerForPushNotifications';

/** A previous denial needs Settings; an unanswered request can show the OS dialog. */
export async function requestNotificationPermissionOrOpenSettings() {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'denied') {
    return registerForPushNotificationsAsync();
  }

  if (Platform.OS === 'android') {
    return IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS,
      { extra: { 'android.provider.extra.APP_PACKAGE': Application.applicationId } },
    );
  }

  return Linking.openSettings();
}
