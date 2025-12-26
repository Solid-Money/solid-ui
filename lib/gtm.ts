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

interface BaseGTMEvent {
  event: string;
  user_id?: string;
  safe_address?: string;
  timestamp?: number;
  platform?: string;
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

export type GTMEvent = SignupGTMEvent | AccountCreationGTMEvent | EmailVerificationGTMEvent | DepositGTMEvent | StakeGTMEvent;

// Track GTM events
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
      // Sanitize event data - remove undefined/null values
      const sanitizedData = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .reduce((acc, [key, value]) => {
          // Ensure values are serializable
          acc[key] = typeof value === 'object' && value !== null ?
            JSON.stringify(value) : value;
          return acc;
        }, {} as Record<string, any>);

      const enrichedEvent = {
        event,
        ...sanitizedData,
        timestamp: params.timestamp || Date.now(),
        platform: params.platform || Platform.OS,
        // Add standard GTM fields
        gtm_event_category: 'addressable',
        gtm_event_version: '1.0',
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
