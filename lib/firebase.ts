import { getAnalytics, logEvent, setUserId, setUserProperties } from '@react-native-firebase/analytics';
import { getApps, initializeApp, setReactNativeAsyncStorage } from '@react-native-firebase/app';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_APP_ID, EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, EXPO_PUBLIC_FIREBASE_DATABASE_URL, EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID, EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, EXPO_PUBLIC_FIREBASE_PROJECT_ID, EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET } from '@/lib/config';

export enum FirebaseEvent {
  SCREEN_VIEW = 'screen_view',
}

const isApp = getApps().length > 0;
const app = getApps()[0];

export const initFirebase = async () => {
  if (Platform.OS !== 'web' || isApp) return;

  try {
    const firebaseConfig = {
      appId: EXPO_PUBLIC_FIREBASE_APP_ID,
      projectId: EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      measurementId: EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
      apiKey: EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      databaseURL: EXPO_PUBLIC_FIREBASE_DATABASE_URL,
    };
  
    setReactNativeAsyncStorage(AsyncStorage);
    await initializeApp(firebaseConfig);
  } catch (error) {
    console.error('Error initializing Firebase:', error);
  }
};

export const trackFirebaseEvent = async (event: string, params: Record<string, any>) => {
  try {
    await logEvent(getAnalytics(app), event, params);
  } catch (error) {
    console.error('Error tracking Firebase event:', error);
  }
}

export const trackFirebaseScreen = async (pathname: string, params: Record<string, any>) => {
  try {
    await logEvent(getAnalytics(app), FirebaseEvent.SCREEN_VIEW, {
      firebase_screen: pathname,
      firebase_screen_class: pathname,
      params: JSON.stringify(params),
    });
  } catch (error) {
    console.error('Error tracking Firebase screen:', error);
  }
}

export const trackFirebaseIdentity = async (id: string, params: Record<string, any>) => {
  try {
    await setUserId(getAnalytics(app), id);
    await setUserProperties(getAnalytics(app), params);
  } catch (error) {
    console.error('Error tracking Firebase identity:', error);
  }
}
