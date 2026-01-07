import { Platform } from 'react-native';

declare global {
  interface Window {
    dataLayer: any[];
  }
}

/**
 * GTM dataLayer utility for Addressable event tracking
 * Pushes events to Google Tag Manager for consumption by Addressable
 */

// GTM events enum
export enum GTMEventType {
  SIGNUP_INITIATED = 'signup_initiated',
  ACCOUNT_CREATED = 'account_created',
  EMAIL_VERIFICATION_INITIATED = 'email_verification_initiated',
  EMAIL_VERIFIED = 'email_verified',
  DEPOSIT_INITIATED = 'deposit_initiated',
  DEPOSIT_COMPLETED = 'deposit_completed',
  DEPOSIT_FAILED = 'deposit_failed',
  DEPOSIT_ABANDONED = 'deposit_abandoned',
  STAKED = 'staked',
}

/**
 * Attribution data structure for GTM events
 * Contains full marketing attribution context for Addressable and Google Ads tracking
 */
interface GTMAttributionData {
  // UTM Parameters
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;

  // Advertising Click IDs
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  ttclid?: string;

  // Referral Attribution
  referral_code?: string;
  referral_source?: string;

  // Attribution Channel Classification
  attribution_channel?: string;

  // Multi-touch Attribution
  first_touch_utm_source?: string;
  first_touch_utm_campaign?: string;
  first_touch_utm_medium?: string;
  first_touch_timestamp?: number;
  last_touch_utm_source?: string;
  last_touch_utm_campaign?: string;
  last_touch_utm_medium?: string;
  last_touch_timestamp?: number;

  // Device Tracking (for anonymous-to-identified bridging)
  device_id?: string;
  amplitude_device_id?: string;
  amplitude_session_id?: number;

  // Landing Page Context
  landing_page?: string;
  landing_page_referrer?: string;
  landing_page_path?: string;
}

interface BaseGTMEvent {
  event: string;
  user_id?: string;
  safe_address?: string;
  timestamp?: number;
  platform?: string;

  // Attribution data (auto-enriched from analytics.ts)
  attribution?: GTMAttributionData;
}

interface SignupGTMEvent extends BaseGTMEvent {
  event: 'signup_initiated' | 'signup_completed';
  username?: string;
  invite_code?: string;
  referral_code?: string;
}

interface AccountCreationGTMEvent extends BaseGTMEvent {
  event: 'account_created';
  username: string;
  signup_method: string;
  has_referral_code: boolean;
}

interface EmailVerificationGTMEvent extends BaseGTMEvent {
  event: 'email_verification_initiated' | 'email_verified' | 'email_verification_failed';
  email?: string;
  context: string;
  error?: string;
}

interface DepositGTMEvent extends BaseGTMEvent {
  event: 'deposit_initiated' | 'deposit_completed' | 'deposit_failed' | 'deposit_abandoned';
  amount?: string;
  deposit_type: 'connected_wallet' | 'safe_account' | 'bank_transfer';
  deposit_method: string;
  chain_id?: number;
  is_first_deposit?: boolean;
  step?: string;
  error?: string;
}

interface StakeGTMEvent extends BaseGTMEvent {
  event: 'staked';
  amount: string;
  token_symbol: string;
}

export type GTMEvent =
  | SignupGTMEvent
  | AccountCreationGTMEvent
  | EmailVerificationGTMEvent
  | DepositGTMEvent
  | StakeGTMEvent;

/**
 * Track GTM events with attribution enrichment
 * Pushes events to Google Tag Manager dataLayer for Addressable and Google Ads
 *
 * Attribution data is automatically enriched by analytics.ts and structured
 * into a nested attribution object for easier GTM trigger configuration
 */
export const trackGTMEvent = (event: string, params: Record<string, any>) => {
  try {
    // Only push to dataLayer on web platform where GTM is available
    if (Platform.OS !== 'web') {
      return;
    }

    // Validate required fields
    if (!event) {
      console.warn('GTM event missing required event field:', { event, params });
      return;
    }

    // Ensure dataLayer exists
    if (typeof window !== 'undefined' && window.dataLayer) {
      // Extract attribution fields from params for structured organization
      const attributionFields = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'gclid',
        'fbclid',
        'msclkid',
        'ttclid',
        'referral_code',
        'referral_source',
        'attribution_channel',
        'first_touch_utm_source',
        'first_touch_utm_campaign',
        'first_touch_utm_medium',
        'first_touch_timestamp',
        'last_touch_utm_source',
        'last_touch_utm_campaign',
        'last_touch_utm_medium',
        'last_touch_timestamp',
        'device_id',
        'amplitude_device_id',
        'amplitude_session_id',
        'landing_page',
        'landing_page_referrer',
        'landing_page_path',
      ];

      // Build attribution object from params
      const attribution: GTMAttributionData = {};
      attributionFields.forEach(field => {
        if (params[field] !== undefined && params[field] !== null) {
          attribution[field as keyof GTMAttributionData] = params[field] as any;
        }
      });

      // Build event data without attribution fields (they're now in attribution object)
      const eventData = Object.entries(params)
        .filter(
          ([key, value]) =>
            value !== undefined && value !== null && !attributionFields.includes(key),
        )
        .reduce(
          (acc, [key, value]) => {
            // Ensure values are serializable
            acc[key] = typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
            return acc;
          },
          {} as Record<string, any>,
        );

      const enrichedEvent = {
        event,
        ...eventData,
        timestamp: params.timestamp || Date.now(),
        platform: params.platform || Platform.OS,
        // Structured attribution object for easier GTM trigger configuration
        attribution: Object.keys(attribution).length > 0 ? attribution : undefined,
        // Add standard GTM fields
        gtm_event_category: 'addressable',
        gtm_event_version: '1.1', // Bumped version to indicate attribution structure change
      };

      window.dataLayer.push(enrichedEvent);

      // Log for debugging in development
      if (__DEV__) {
        console.log('GTM Event pushed for Addressable:', enrichedEvent);
      }
    } else {
      console.warn('GTM dataLayer not available');
    }
  } catch (error) {
    console.error('Error pushing to GTM dataLayer:', error);
  }
};
