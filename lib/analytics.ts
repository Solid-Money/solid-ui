// Amplitude imports
import { Identify, identify, init as initAmplitudeSDK, setUserId as setAmplitudeUserId, track as trackAmplitude } from '@amplitude/analytics-react-native';
// Firebase imports
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAnalytics, logEvent, setUserId as setFirebaseUserId, setUserProperties } from '@react-native-firebase/analytics';
import { getApps, initializeApp, setReactNativeAsyncStorage } from '@react-native-firebase/app';
import { Platform } from 'react-native';
// Local imports
import { EXPO_PUBLIC_AMPLITUDE_API_KEY, EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_APP_ID, EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, EXPO_PUBLIC_FIREBASE_DATABASE_URL, EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID, EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, EXPO_PUBLIC_FIREBASE_PROJECT_ID, EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET } from '@/lib/config';
import { trackGTMEvent } from '@/lib/gtm';
import { sanitize, toTitleCase } from '@/lib/utils/utils';

// Firebase app instance
const isFirebaseApp = getApps().length > 0;
const firebaseApp = getApps()[0];

// Amplitude events enum
export enum AmplitudeEvent {
  PAGE_VIEWED = '[Amplitude] Page Viewed',
}

// Firebase events enum
export enum FirebaseEvent {
  SCREEN_VIEW = 'screen_view',
}

export const formatAmplitudeEvent = (str: string) => {
  return str.split('_').map(word => toTitleCase(word)).join(' ');
};

// Initialize Amplitude
const initAmplitude = () => {
  try {
    initAmplitudeSDK(EXPO_PUBLIC_AMPLITUDE_API_KEY);
  } catch (error) {
    console.error('Error initializing Amplitude:', error);
  }
};

// Initialize Firebase
const initFirebase = async () => {
  if (Platform.OS !== 'web' || isFirebaseApp) return;

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

// Initialize all analytics providers
export const initAnalytics = async () => {
  try {
    initAmplitude();
    await initFirebase();
  } catch (error) {
    console.error('Failed to initialize analytics:', error);
    // Don't throw - allow app to continue even if analytics fails
  }
};

// Track Amplitude events
const trackAmplitudeEvent = (event: string, params: Record<string, any>) => {
  try {
    trackAmplitude(formatAmplitudeEvent(event), params);
  } catch (error) {
    console.error('Error tracking Amplitude event:', error);
  }
};

// Track Firebase events
const trackFirebaseEvent = async (event: string, params: Record<string, any>) => {
  try {
    // Only track if Firebase is available (web only)
    if (Platform.OS === 'web' && firebaseApp) {
      await logEvent(getAnalytics(firebaseApp), event, params);
    }
  } catch (error) {
    console.error('Error tracking Firebase event:', error);
  }
};

// Main track function
export const track = (event: string, params: Record<string, any> = {}) => {
  try {
    // Validate inputs
    if (!event || typeof event !== 'string') {
      console.warn('Invalid event name provided to track():', event);
      return;
    }

    // Sanitize params - remove undefined/null values and ensure serializable
    const sanitizedParams = sanitize(params);

    // Track to all providers in parallel
    Promise.allSettled([
      Promise.resolve(trackAmplitudeEvent(event, sanitizedParams)),
      trackFirebaseEvent(event, sanitizedParams),
      Promise.resolve(trackGTMEvent(event, sanitizedParams)),
    ]);
  } catch (error) {
    console.error('Error tracking event:', error);
  }
};

// Track Amplitude screens
const trackAmplitudeScreen = (pathname: string, params: Record<string, any>) => {
  try {
    trackAmplitude(AmplitudeEvent.PAGE_VIEWED, {
      pathname,
      params,
    });
  } catch (error) {
    console.error('Error tracking Amplitude screen:', error);
  }
};

// Track Firebase screens
const trackFirebaseScreen = async (pathname: string, params: Record<string, any>) => {
  try {
    // Only track if Firebase is available (web only)
    if (Platform.OS === 'web' && firebaseApp) {
      await logEvent(getAnalytics(firebaseApp), FirebaseEvent.SCREEN_VIEW, {
        firebase_screen: pathname,
        firebase_screen_class: pathname,
        params: JSON.stringify(params),
      });
    }
  } catch (error) {
    console.error('Error tracking Firebase screen:', error);
  }
};

// Main screen tracking function
export const trackScreen = (pathname: string, params: Record<string, any> = {}) => {
  try {
    // Validate inputs
    if (!pathname || typeof pathname !== 'string') {
      console.warn('Invalid pathname provided to trackScreen():', pathname);
      return;
    }

    // Sanitize params
    const sanitizedParams = sanitize(params);

    // Track to all providers in parallel
    Promise.allSettled([
      Promise.resolve(trackAmplitudeScreen(pathname, sanitizedParams)),
      trackFirebaseScreen(pathname, sanitizedParams),
    ]);
  } catch (error) {
    console.error('Error tracking screen:', error);
  }
};

// Track Amplitude identity
const trackAmplitudeIdentity = (id: string, params: Record<string, any>) => {
  try {
    setAmplitudeUserId(id);
    const identifyObj = new Identify();
    identifyObj.set('user_properties', params);
    identify(identifyObj);
  } catch (error) {
    console.error('Error tracking Amplitude identity:', error);
  }
};

// Track Firebase identity
const trackFirebaseIdentity = async (id: string, params: Record<string, any>) => {
  try {
    // Only track if Firebase is available (web only)
    if (Platform.OS === 'web' && firebaseApp) {
      await setFirebaseUserId(getAnalytics(firebaseApp), id);
      await setUserProperties(getAnalytics(firebaseApp), params);
    }
  } catch (error) {
    console.error('Error tracking Firebase identity:', error);
  }
};

// Main identity tracking function
export const trackIdentity = (id: string, params: Record<string, any> = {}) => {
  try {
    // Validate inputs
    if (!id || typeof id !== 'string') {
      console.warn('Invalid user ID provided to trackIdentity():', id);
      return;
    }

    // Sanitize params
    const sanitizedParams = sanitize(params);

    // Track to all providers in parallel
    Promise.allSettled([
      Promise.resolve(trackAmplitudeIdentity(id, sanitizedParams)),
      trackFirebaseIdentity(id, sanitizedParams),
    ]);

    // Push user identification to GTM dataLayer
    if (typeof window !== 'undefined' && window.dataLayer) {
      try {
        window.dataLayer.push({
          event: 'user_identified',
          user_id: id,
          timestamp: Date.now(),
          platform: Platform.OS,
          ...sanitizedParams,
        });
      } catch (error) {
        console.error('Error pushing identity to GTM dataLayer:', error);
      }
    }
  } catch (error) {
    console.error('Error tracking identity:', error);
  }
};
