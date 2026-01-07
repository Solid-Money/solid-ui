import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { USER } from '@/lib/config';
import mmkvStorage from '@/lib/mmvkStorage';
import { useReferralStore } from './useReferralStore';

/**
 * Attribution data structure capturing all marketing attribution parameters
 */
export interface AttributionData {
  // UTM Parameters (standard marketing attribution)
  utm_source?: string; // e.g., 'google', 'twitter', 'facebook'
  utm_medium?: string; // e.g., 'cpc', 'social', 'email'
  utm_campaign?: string; // e.g., 'summer_2026', 'launch_week'
  utm_content?: string; // e.g., 'ad_variant_a', 'hero_cta'
  utm_term?: string; // e.g., 'crypto_savings', 'defi_app'

  // Advertising Platform Click IDs
  gclid?: string; // Google Click ID
  fbclid?: string; // Facebook Click ID
  msclkid?: string; // Microsoft Click ID
  ttclid?: string; // TikTok Click ID

  // Referral Attribution
  referral_code?: string; // User referral code
  referral_source?: 'url' | 'storage' | 'deeplink' | null; // How referral was captured

  // Timestamps (for attribution windows)
  first_visit_timestamp?: number; // When user first visited
  last_visit_timestamp?: number; // Most recent visit
  attribution_captured_at?: number; // When this attribution was captured

  // Session & Device Tracking
  anonymous_device_id?: string; // Device ID before authentication
  amplitude_device_id?: string; // Amplitude's device ID
  amplitude_session_id?: number; // Amplitude's session ID

  // Landing Page Context
  landing_page?: string; // URL of first page visited
  landing_page_referrer?: string; // HTTP referrer header
  landing_page_path?: string; // URL path only (e.g., '/signup')

  // Attribution Model Support
  attribution_type?: 'first_touch' | 'last_touch' | 'multi_touch'; // Which attribution model
}

/**
 * First-touch and last-touch attribution data for multi-touch attribution
 */
export interface MultiTouchAttribution {
  first_touch?: AttributionData;
  last_touch?: AttributionData;
}

interface AttributionState {
  // Current attribution data (combines first/last touch logic)
  attributionData: AttributionData;

  // Multi-touch attribution tracking
  multiTouchData: MultiTouchAttribution;

  // Hydration state
  _hasHydrated: boolean;

  // Actions
  setAttributionData: (data: Partial<AttributionData>) => void;
  updateAttribution: (data: Partial<AttributionData>) => void;
  clearAttribution: () => void;
  captureFromURL: (url?: string) => AttributionData | null;
  captureFromDeepLink: (deepLinkUrl: string) => AttributionData | null;
  saveFirstTouchAttribution: (data: AttributionData) => void;
  saveLastTouchAttribution: (data: AttributionData) => void;
  saveReferralAttribution: (data: {
    referral_code: string;
    referral_source: 'url' | 'storage' | 'deeplink';
    referral_timestamp: number;
  }) => void;
  getAttributionForEvent: () => AttributionData;
  hasAttribution: () => boolean;
  isAttributionExpired: (windowDays?: number) => boolean;
  setHasHydrated: (state: boolean) => void;
}

/**
 * Parse UTM parameters and advertising IDs from URL query string
 */
const parseAttributionFromURL = (url: string): Partial<AttributionData> => {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    const attribution: Partial<AttributionData> = {};

    // UTM parameters
    if (params.get('utm_source')) attribution.utm_source = params.get('utm_source')!;
    if (params.get('utm_medium')) attribution.utm_medium = params.get('utm_medium')!;
    if (params.get('utm_campaign')) attribution.utm_campaign = params.get('utm_campaign')!;
    if (params.get('utm_content')) attribution.utm_content = params.get('utm_content')!;
    if (params.get('utm_term')) attribution.utm_term = params.get('utm_term')!;

    // Advertising Click IDs
    if (params.get('gclid')) attribution.gclid = params.get('gclid')!;
    if (params.get('fbclid')) attribution.fbclid = params.get('fbclid')!;
    if (params.get('msclkid')) attribution.msclkid = params.get('msclkid')!;
    if (params.get('ttclid')) attribution.ttclid = params.get('ttclid')!;

    // Referral codes (multiple param names for compatibility)
    const refCode =
      params.get('ref') ||
      params.get('refCode') ||
      params.get('referralCode') ||
      params.get('referral');
    if (refCode) {
      attribution.referral_code = refCode;
      attribution.referral_source = 'url';
    }

    // Landing page info
    attribution.landing_page = url;
    attribution.landing_page_path = urlObj.pathname;
    attribution.attribution_captured_at = Date.now();

    return attribution;
  } catch (error) {
    console.warn('Failed to parse attribution from URL:', error);
    Sentry.captureException(error, {
      tags: { type: 'attribution_url_parse_error' },
      level: 'warning',
    });
    return {};
  }
};

/**
 * Parse attribution from deep link URL (mobile)
 */
const parseAttributionFromDeepLink = (deepLinkUrl: string): Partial<AttributionData> => {
  try {
    // Deep links often use custom schemes like 'solid://...' or universal links
    // Extract query parameters the same way as web URLs
    const attribution = parseAttributionFromURL(deepLinkUrl);
    if (attribution.referral_code) {
      attribution.referral_source = 'deeplink';
    }
    return attribution;
  } catch (error) {
    console.warn('Failed to parse attribution from deep link:', error);
    Sentry.captureException(error, {
      tags: { type: 'attribution_deeplink_parse_error' },
      level: 'warning',
    });
    return {};
  }
};

/**
 * Sanitize attribution data to remove PII and invalid values
 */
const sanitizeAttribution = (data: Partial<AttributionData>): Partial<AttributionData> => {
  const sanitized: Partial<AttributionData> = {};

  // Remove any potential PII patterns (emails, phone numbers, etc.)
  const piiPattern =
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

  Object.entries(data).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;

    // Check for PII in string values
    if (typeof value === 'string') {
      if (!piiPattern.test(value)) {
        sanitized[key as keyof AttributionData] = value.trim() as any;
      } else {
        console.warn(`Potential PII detected in attribution field ${key}, removing`);
      }
    } else {
      sanitized[key as keyof AttributionData] = value as any;
    }
  });

  return sanitized;
};

/**
 * Zustand store for managing attribution data with MMKV persistence
 * Tracks first-touch, last-touch, and multi-touch attribution across sessions
 */
export const useAttributionStore = create<AttributionState>()(
  persist(
    (set, get) => ({
      attributionData: {},
      multiTouchData: {},
      _hasHydrated: false,
      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),

      /**
       * Set complete attribution data (replaces existing)
       */
      setAttributionData: (data: Partial<AttributionData>) => {
        const sanitized = sanitizeAttribution(data);
        set({
          attributionData: {
            ...sanitized,
            last_visit_timestamp: Date.now(),
          },
        });
      },

      /**
       * Update attribution data (merges with existing)
       */
      updateAttribution: (data: Partial<AttributionData>) => {
        const sanitized = sanitizeAttribution(data);
        set(state => ({
          attributionData: {
            ...state.attributionData,
            ...sanitized,
            last_visit_timestamp: Date.now(),
          },
        }));
      },

      /**
       * Clear all attribution data
       */
      clearAttribution: () => {
        set({
          attributionData: {},
          multiTouchData: {},
        });
        console.warn('Attribution data cleared');
      },

      /**
       * Capture attribution from current URL (web only)
       */
      captureFromURL: (url?: string) => {
        if (Platform.OS !== 'web') return null;

        try {
          const targetUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
          if (!targetUrl) return null;

          const parsed = parseAttributionFromURL(targetUrl);

          // Only save if we actually found attribution data
          if (Object.keys(parsed).length > 0) {
            const existing = get().attributionData;

            // Capture referrer if available
            if (typeof document !== 'undefined' && document.referrer) {
              parsed.landing_page_referrer = document.referrer;
            }

            // If this is first visit, save as first-touch
            if (!existing.first_visit_timestamp) {
              parsed.first_visit_timestamp = Date.now();
              parsed.attribution_type = 'first_touch';
              get().saveFirstTouchAttribution(parsed as AttributionData);
            } else {
              // Subsequent visits are last-touch
              parsed.attribution_type = 'last_touch';
              get().saveLastTouchAttribution(parsed as AttributionData);
            }

            get().updateAttribution(parsed);
            console.warn('Attribution captured from URL:', parsed);

            // Sync referral code to referral store for backward compatibility
            if (parsed.referral_code) {
              const referralStore = useReferralStore.getState();
              referralStore.setReferralCode(parsed.referral_code);
              console.warn('Referral code synced to referral store:', parsed.referral_code);
            }

            return parsed as AttributionData;
          }

          return null;
        } catch (error) {
          console.warn('Failed to capture attribution from URL:', error);
          Sentry.captureException(error, {
            tags: { type: 'attribution_capture_error' },
            level: 'warning',
          });
          return null;
        }
      },

      /**
       * Capture attribution from deep link (mobile)
       */
      captureFromDeepLink: (deepLinkUrl: string) => {
        try {
          const parsed = parseAttributionFromDeepLink(deepLinkUrl);

          if (Object.keys(parsed).length > 0) {
            const existing = get().attributionData;

            if (!existing.first_visit_timestamp) {
              parsed.first_visit_timestamp = Date.now();
              parsed.attribution_type = 'first_touch';
              get().saveFirstTouchAttribution(parsed as AttributionData);
            } else {
              parsed.attribution_type = 'last_touch';
              get().saveLastTouchAttribution(parsed as AttributionData);
            }

            get().updateAttribution(parsed);
            console.warn('Attribution captured from deep link:', parsed);

            // Sync referral code to referral store for backward compatibility
            if (parsed.referral_code) {
              const referralStore = useReferralStore.getState();
              referralStore.setReferralCode(parsed.referral_code);
              console.warn('Referral code synced to referral store:', parsed.referral_code);
            }

            return parsed as AttributionData;
          }

          return null;
        } catch (error) {
          console.warn('Failed to capture attribution from deep link:', error);
          Sentry.captureException(error, {
            tags: { type: 'attribution_deeplink_capture_error' },
            level: 'warning',
          });
          return null;
        }
      },

      /**
       * Save first-touch attribution (never overwrite once set)
       */
      saveFirstTouchAttribution: (data: AttributionData) => {
        set(state => {
          // Only save if we don't already have first-touch data
          if (state.multiTouchData.first_touch) {
            return state; // Don't overwrite existing first-touch
          }

          return {
            multiTouchData: {
              ...state.multiTouchData,
              first_touch: {
                ...data,
                attribution_type: 'first_touch',
                first_visit_timestamp: data.first_visit_timestamp || Date.now(),
              },
            },
          };
        });
      },

      /**
       * Save last-touch attribution (always update with latest)
       */
      saveLastTouchAttribution: (data: AttributionData) => {
        set(state => ({
          multiTouchData: {
            ...state.multiTouchData,
            last_touch: {
              ...data,
              attribution_type: 'last_touch',
              last_visit_timestamp: Date.now(),
            },
          },
        }));
      },

      /**
       * Save referral attribution (integrates with existing useReferralStore)
       */
      saveReferralAttribution: (data: {
        referral_code: string;
        referral_source: 'url' | 'storage' | 'deeplink';
        referral_timestamp: number;
      }) => {
        get().updateAttribution({
          referral_code: data.referral_code,
          referral_source: data.referral_source,
          attribution_captured_at: data.referral_timestamp,
        });
      },

      /**
       * Get attribution data for tracking events
       * Returns merged first-touch and last-touch data with preference for first-touch
       */
      getAttributionForEvent: () => {
        const { attributionData, multiTouchData } = get();

        // Return combined attribution with first-touch taking precedence for source/campaign
        // but including both first and last touch data
        return {
          ...attributionData,
          // First-touch attribution (never changes)
          first_touch_utm_source: multiTouchData.first_touch?.utm_source,
          first_touch_utm_campaign: multiTouchData.first_touch?.utm_campaign,
          first_touch_utm_medium: multiTouchData.first_touch?.utm_medium,
          first_touch_timestamp: multiTouchData.first_touch?.first_visit_timestamp,
          // Last-touch attribution (most recent)
          last_touch_utm_source: multiTouchData.last_touch?.utm_source,
          last_touch_utm_campaign: multiTouchData.last_touch?.utm_campaign,
          last_touch_utm_medium: multiTouchData.last_touch?.utm_medium,
          last_touch_timestamp: multiTouchData.last_touch?.last_visit_timestamp,
        };
      },

      /**
       * Check if we have any attribution data
       */
      hasAttribution: () => {
        const { attributionData } = get();
        return (
          !!attributionData.utm_source ||
          !!attributionData.utm_campaign ||
          !!attributionData.referral_code ||
          !!attributionData.gclid ||
          !!attributionData.fbclid
        );
      },

      /**
       * Check if attribution has expired (default 30-day window)
       */
      isAttributionExpired: (windowDays: number = 30) => {
        const { attributionData } = get();
        if (!attributionData.first_visit_timestamp) return true;

        const windowMs = windowDays * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const ageMs = now - attributionData.first_visit_timestamp;

        return ageMs > windowMs;
      },
    }),
    {
      name: USER.attributionStorageKey,
      storage: createJSONStorage(() => mmkvStorage(USER.attributionStorageKey)),
      onRehydrateStorage: () => state => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
