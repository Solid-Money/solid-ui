// Amplitude imports
import { Platform } from 'react-native';
import {
  add,
  getDeviceId,
  getSessionId,
  Identify,
  identify,
  init as initAmplitudeSDK,
  setUserId as setAmplitudeUserId,
  track as trackAmplitude,
} from '@amplitude/analytics-react-native';
// Firebase imports
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAnalytics,
  logEvent,
  setUserId as setFirebaseUserId,
  setUserProperties,
} from '@react-native-firebase/analytics';
import { getApps, initializeApp, setReactNativeAsyncStorage } from '@react-native-firebase/app';

// Local imports
import { getAttributionChannel } from '@/lib/attribution';
import {
  EXPO_PUBLIC_AMPLITUDE_API_KEY,
  EXPO_PUBLIC_AMPLITUDE_PROXY_URL,
  EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
} from '@/lib/config';
import { trackGTMEvent } from '@/lib/gtm';
import { sanitize, toTitleCase } from '@/lib/utils/utils';
import { useAttributionStore } from '@/store/useAttributionStore';

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
  return str
    .split('_')
    .map(word => toTitleCase(word))
    .join(' ');
};

// Initialize Amplitude
const initAmplitude = async (isTrackingAllowed = false) => {
  try {
    const sampleRate = 0.2;

    if (Platform.OS === 'web') {
      // Web: add plugin BEFORE init
      const { sessionReplayPlugin } = await import('@amplitude/plugin-session-replay-browser');
      await add(
        sessionReplayPlugin({
          sampleRate,
        }),
      ).promise;
    }

    // Use proxy URL if configured (bypasses ad blockers in production)
    const amplitudeConfig: Record<string, any> = EXPO_PUBLIC_AMPLITUDE_PROXY_URL
      ? { serverUrl: EXPO_PUBLIC_AMPLITUDE_PROXY_URL }
      : {};

    // On iOS, disable IDFA collection unless user granted ATT permission.
    // This prevents App Store rejection under Guideline 5.1.2.
    if (Platform.OS === 'ios' && !isTrackingAllowed) {
      amplitudeConfig.trackingOptions = { adid: false };
    }

    const config = Object.keys(amplitudeConfig).length > 0 ? amplitudeConfig : undefined;

    await initAmplitudeSDK(EXPO_PUBLIC_AMPLITUDE_API_KEY, undefined, config).promise;

    if (Platform.OS !== 'web') {
      // Native: add plugin AFTER init
      const { SessionReplayPlugin } = await import('@amplitude/plugin-session-replay-react-native');
      await add(
        new SessionReplayPlugin({
          sampleRate,
          enableRemoteConfig: true,
          autoStart: true,
        }),
      ).promise;
    }
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
export const initAnalytics = async (isTrackingAllowed = false) => {
  // Don't initialize analytics locally
  if (__DEV__) {
    return;
  }

  try {
    await initAmplitude(isTrackingAllowed);
    await initFirebase();
  } catch (error) {
    console.error('Failed to initialize analytics:', error);
    // Don't throw - allow app to continue even if analytics fails
  }
};

/**
 * Get Amplitude device ID for anonymous user tracking
 * This ID persists across sessions and is used to bridge anonymous -> identified users
 */
export const getAmplitudeDeviceId = (): string | undefined => {
  try {
    return getDeviceId();
  } catch (error) {
    console.error('Error getting Amplitude device ID:', error);
    return undefined;
  }
};

/**
 * Get Amplitude session ID for session-based analytics
 */
export const getAmplitudeSessionId = (): number | undefined => {
  try {
    return getSessionId();
  } catch (error) {
    console.error('Error getting Amplitude session ID:', error);
    return undefined;
  }
};

// Track Amplitude events
const trackAmplitudeEvent = (event: string, params: Record<string, any>) => {
  // Don't track events locally
  if (__DEV__) {
    return;
  }

  try {
    trackAmplitude(formatAmplitudeEvent(event), params);
  } catch (error) {
    console.error('Error tracking Amplitude event:', error);
  }
};

// Track Firebase events
const trackFirebaseEvent = async (event: string, params: Record<string, any>) => {
  // Don't track events locally
  if (__DEV__) {
    return;
  }

  try {
    // Only track if Firebase is available (web only)
    if (Platform.OS === 'web' && firebaseApp) {
      await logEvent(getAnalytics(firebaseApp), event, params);
    }
  } catch (error) {
    console.error('Error tracking Firebase event:', error);
  }
};

// Main track function with automatic attribution enrichment
export const track = (event: string, params: Record<string, any> = {}) => {
  // Don't track events locally
  if (__DEV__) {
    return;
  }

  try {
    // Validate inputs
    if (!event || typeof event !== 'string') {
      console.warn('Invalid event name provided to track():', event);
      return;
    }

    // Get attribution data from store
    const attributionStore = useAttributionStore.getState();
    const attributionData = attributionStore.getAttributionForEvent();
    const deviceId = getAmplitudeDeviceId();
    const sessionId = getAmplitudeSessionId();

    // Enrich params with attribution and device context
    const enrichedParams = {
      ...params,
      // Attribution data (UTM params, referral codes, etc.)
      ...attributionData,
      // Attribution channel for easier filtering
      attribution_channel: getAttributionChannel(attributionData),
      // Device/session tracking for anonymous-to-identified user bridging
      amplitude_device_id: deviceId,
      amplitude_session_id: sessionId,
      // Platform context
      platform: Platform.OS,
      // Timestamp
      timestamp: Date.now(),
    };

    // Sanitize all params once - remove undefined/null values and ensure serializable
    const sanitizedParams = sanitize(enrichedParams);

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
  // Don't track screens locally
  if (__DEV__) {
    return;
  }

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
  // Don't track screens locally
  if (__DEV__) {
    return;
  }

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
  // Don't track screens locally
  if (__DEV__) {
    return;
  }

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
  // Don't track identity locally
  if (__DEV__) {
    return;
  }

  try {
    setAmplitudeUserId(id);
    const identifyObj = new Identify();
    // Set each field as individual user property for searchability in Amplitude
    Object.entries(params).forEach(([key, value]) => {
      identifyObj.set(key, value);
    });
    identify(identifyObj);
  } catch (error) {
    console.error('Error tracking Amplitude identity:', error);
  }
};

// Track Firebase identity
const trackFirebaseIdentity = async (id: string, params: Record<string, any>) => {
  // Don't track identity locally
  if (__DEV__) {
    return;
  }

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

// Main identity tracking function with attribution enrichment
export const trackIdentity = (id: string, params: Record<string, any> = {}) => {
  // Don't track identity locally
  if (__DEV__) {
    return;
  }

  try {
    // Validate inputs
    if (!id || typeof id !== 'string') {
      console.warn('Invalid user ID provided to trackIdentity():', id);
      return;
    }

    // Get attribution data and device IDs
    const attributionStore = useAttributionStore.getState();
    const attributionData = attributionStore.getAttributionForEvent();
    const deviceId = getAmplitudeDeviceId();

    // Enrich with FULL attribution context for user identification
    const enrichedParams = {
      ...params,
      // Attribution data (critical for identifying which campaign brought this user)
      ...sanitize(attributionData),
      // Attribution channel
      attribution_channel: getAttributionChannel(attributionData),
      // Anonymous device ID for bridging pre-signup and post-signup sessions
      anonymous_device_id: deviceId,
      // Identification timestamp
      identified_timestamp: Date.now(),
      // Platform
      platform: Platform.OS,
    };

    // Sanitize params
    const sanitizedParams = sanitize(enrichedParams);

    // Track to all providers in parallel
    Promise.allSettled([
      Promise.resolve(trackAmplitudeIdentity(id, sanitizedParams)),
      trackFirebaseIdentity(id, sanitizedParams),
    ]);

    // Push user identification to GTM dataLayer with full attribution
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
