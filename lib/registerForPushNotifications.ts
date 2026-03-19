import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';

import { registerPushToken } from '@/lib/api';

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    throw new Error('Must use physical device for push notifications');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permission not granted to get push token for push notification!');

    return null;
  }

  try {
    const fcmToken = await messaging().getToken();

    // Persist token to backend (best-effort — don't block on failure)
    const platform = Platform.OS as 'ios' | 'android';
    await registerPushToken(fcmToken, platform);

    return fcmToken;
  } catch (e: unknown) {
    throw new Error(`${e}`);
  }
}
