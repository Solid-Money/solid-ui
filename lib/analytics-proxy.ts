import { EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { Platform } from 'react-native';

const DEVICE_ID_STORAGE_KEY = 'amplitude_proxy_device_id';

// Create MMKV storage instance for analytics
const analyticsStorage = mmkvStorage('analytics-proxy');

interface TrackEventPayload {
  event_type: string;
  user_id?: string;
  device_id?: string;
  event_properties?: Record<string, any>;
  user_properties?: Record<string, any>;
  platform?: string;
  os_name?: string;
  os_version?: string;
  device_model?: string;
  language?: string;
  session_id?: string;
  time?: number;
}

interface IdentifyPayload {
  user_id: string;
  device_id?: string;
  user_properties?: Record<string, any>;
}

interface ProxyResponse {
  success: boolean;
  error?: string;
}

// Device info cache
let cachedDeviceInfo: {
  platform: string;
  os_name: string;
  os_version?: string;
  language: string;
} | null = null;

const getDeviceInfo = () => {
  if (cachedDeviceInfo) return cachedDeviceInfo;

  cachedDeviceInfo = {
    platform: Platform.OS,
    os_name: Platform.OS,
    os_version: Platform.Version?.toString(),
    language: typeof navigator !== 'undefined' ? navigator.language : 'en',
  };

  return cachedDeviceInfo;
};

// Device ID - uses MMKV for synchronous storage
let cachedDeviceId: string | null = null;

const getDeviceId = (): string => {
  if (cachedDeviceId) return cachedDeviceId;

  // Try to get from MMKV storage (synchronous)
  const storedDeviceId = analyticsStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (storedDeviceId) {
    cachedDeviceId = storedDeviceId;
    return cachedDeviceId as string;
  }

  // Generate new device ID and persist it
  cachedDeviceId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  analyticsStorage.setItem(DEVICE_ID_STORAGE_KEY, cachedDeviceId);

  return cachedDeviceId;
};

// Session management
let sessionId: string | null = null;
let sessionStartTime: number | null = null;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const getSessionId = (): string => {
  const now = Date.now();

  // Start new session if none exists or if session has expired
  if (!sessionId || !sessionStartTime || now - sessionStartTime > SESSION_TIMEOUT_MS) {
    sessionId = now.toString();
    sessionStartTime = now;
  }

  return sessionId;
};

// Current user ID (set via identify)
let currentUserId: string | null = null;

const getProxyUrl = (endpoint: string): string => {
  const baseUrl = EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL.replace(/\/$/, '');
  return `${baseUrl}/v1/proxy/${endpoint}`;
};

/**
 * Track an event via the server-side proxy
 * This bypasses ad blockers by routing through your own backend
 */
export const trackViaProxy = async (
  eventType: string,
  eventProperties?: Record<string, any>,
): Promise<ProxyResponse> => {
  if (!EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL) {
    console.warn('Analytics proxy URL not configured');
    return { success: false, error: 'Proxy URL not configured' };
  }

  try {
    const deviceInfo = getDeviceInfo();
    const payload: TrackEventPayload = {
      event_type: eventType,
      user_id: currentUserId || undefined,
      device_id: getDeviceId(),
      event_properties: eventProperties,
      session_id: getSessionId(),
      time: Date.now(),
      ...deviceInfo,
    };

    const response = await fetch(getProxyUrl('track'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to track event via proxy:', error);
    return { success: false, error: 'Failed to send event' };
  }
};

/**
 * Track multiple events in a batch via the server-side proxy
 */
export const trackBatchViaProxy = async (
  events: Array<{ eventType: string; eventProperties?: Record<string, any> }>,
): Promise<ProxyResponse> => {
  if (!EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL) {
    console.warn('Analytics proxy URL not configured');
    return { success: false, error: 'Proxy URL not configured' };
  }

  try {
    const deviceInfo = getDeviceInfo();
    const deviceId = getDeviceId();
    const sessionIdValue = getSessionId();

    const payload = {
      events: events.map((event) => ({
        event_type: event.eventType,
        user_id: currentUserId || undefined,
        device_id: deviceId,
        event_properties: event.eventProperties,
        session_id: sessionIdValue,
        time: Date.now(),
        ...deviceInfo,
      })),
    };

    const response = await fetch(getProxyUrl('batch'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to track batch events via proxy:', error);
    return { success: false, error: 'Failed to send events' };
  }
};

/**
 * Identify a user via the server-side proxy
 */
export const identifyViaProxy = async (
  userId: string,
  userProperties?: Record<string, any>,
): Promise<ProxyResponse> => {
  if (!EXPO_PUBLIC_FLASH_ANALYTICS_API_BASE_URL) {
    console.warn('Analytics proxy URL not configured');
    return { success: false, error: 'Proxy URL not configured' };
  }

  // Update local user ID
  currentUserId = userId;

  try {
    const payload: IdentifyPayload = {
      user_id: userId,
      device_id: getDeviceId(),
      user_properties: userProperties,
    };

    const response = await fetch(getProxyUrl('identify'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to identify user via proxy:', error);
    return { success: false, error: 'Failed to identify user' };
  }
};

/**
 * Reset the current user (on logout)
 */
export const resetProxyUser = (): void => {
  currentUserId = null;
  sessionId = null;
  sessionStartTime = null;
};
