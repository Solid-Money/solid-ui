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
const trackGTMEvent = (event: string, params: Record<string, any>) => {
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

// Main GTM track function for facade pattern
export const track = (event: string, params: Record<string, any> = {}) => {
  trackGTMEvent(event, params);
};

/**
 * Push event to GTM dataLayer for Addressable tracking
 */
export const pushToGTM = (eventData: GTMEvent) => {
  try {
    // Only push to dataLayer on web platform where GTM is available
    if (Platform.OS !== 'web') {
      return;
    }

    // Validate required fields
    if (!eventData.event) {
      console.warn('GTM event missing required event field:', eventData);
      return;
    }

    // Ensure dataLayer exists
    if (typeof window !== 'undefined' && window.dataLayer) {
      // Sanitize event data - remove undefined/null values
      const sanitizedData = Object.entries(eventData)
        .filter(([_, value]) => value !== undefined && value !== null)
        .reduce((acc, [key, value]) => {
          // Ensure values are serializable
          acc[key] = typeof value === 'object' && value !== null ?
            JSON.stringify(value) : value;
          return acc;
        }, {} as Record<string, any>);

      const enrichedEvent = {
        ...sanitizedData,
        timestamp: eventData.timestamp || Date.now(),
        platform: eventData.platform || Platform.OS,
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

/**
 * Helper functions for specific Addressable events
 */

export const trackSignupInitiated = (data: {
  user_id?: string;
  username?: string;
}) => {
  // Validate required data
  if (!data.username) {
    console.warn('trackSignupInitiated missing required username');
    return;
  }

  pushToGTM({
    event: 'signup_initiated',
    user_id: data.user_id,
    username: data.username,
  });
};

export const trackSignupCompleted = (data: {
  user_id: string;
  safe_address: string;
  username: string;
  invite_code?: string;
  referral_code?: string;
}) => {
  // Validate required data
  if (!data.user_id || !data.safe_address || !data.username) {
    console.warn('trackSignupCompleted missing required fields:', data);
    return;
  }

  pushToGTM({
    event: 'signup_completed',
    user_id: data.user_id,
    safe_address: data.safe_address,
    username: data.username,
    invite_code: data.invite_code,
    referral_code: data.referral_code,
  });
};

export const trackAccountCreated = (data: {
  user_id: string;
  safe_address: string;
  username: string;
  signup_method: string;
  has_referral_code: boolean;
}) => {
  pushToGTM({
    event: 'account_created',
    user_id: data.user_id,
    safe_address: data.safe_address,
    username: data.username,
    signup_method: data.signup_method,
    has_referral_code: data.has_referral_code,
  });
};

export const trackEmailVerificationInitiated = (data: {
  user_id?: string;
  safe_address?: string;
  email?: string;
  context: string;
}) => {
  pushToGTM({
    event: 'email_verification_initiated',
    user_id: data.user_id,
    safe_address: data.safe_address,
    email: data.email,
    context: data.context,
  });
};

export const trackEmailVerified = (data: {
  user_id?: string;
  safe_address?: string;
  email: string;
  context: string;
}) => {
  pushToGTM({
    event: 'email_verified',
    user_id: data.user_id,
    safe_address: data.safe_address,
    email: data.email,
    context: data.context,
  });
};

export const trackEmailVerificationFailed = (data: {
  user_id?: string;
  safe_address?: string;
  email?: string;
  context: string;
  error: string;
}) => {
  pushToGTM({
    event: 'email_verification_failed',
    user_id: data.user_id,
    safe_address: data.safe_address,
    email: data.email,
    context: data.context,
    error: data.error,
  });
};

export const trackDepositInitiated = (data: {
  user_id?: string;
  safe_address?: string;
  amount?: string;
  deposit_type: 'connected_wallet' | 'safe_account' | 'bank_transfer';
  deposit_method: string;
  chain_id?: number;
}) => {
  // Validate required data
  if (!data.deposit_type || !data.deposit_method) {
    console.warn('trackDepositInitiated missing required fields:', data);
    return;
  }

  // Convert amount to number for better analytics
  const numericAmount = data.amount ? parseFloat(data.amount) : undefined;
  if (data.amount && numericAmount !== undefined && isNaN(numericAmount)) {
    console.warn('trackDepositInitiated: invalid amount format:', data.amount);
  }

  pushToGTM({
    event: 'deposit_initiated',
    user_id: data.user_id,
    safe_address: data.safe_address,
    amount: numericAmount?.toString() || data.amount,
    deposit_type: data.deposit_type,
    deposit_method: data.deposit_method,
    chain_id: data.chain_id,
  });
};

export const trackDepositCompleted = (data: {
  user_id?: string;
  safe_address?: string;
  amount: string;
  deposit_type: 'connected_wallet' | 'safe_account' | 'bank_transfer';
  deposit_method: string;
  chain_id?: number;
  is_first_deposit?: boolean;
}) => {
  // Validate required data
  if (!data.amount || !data.deposit_type || !data.deposit_method) {
    console.warn('trackDepositCompleted missing required fields:', data);
    return;
  }

  // Convert amount to number for better analytics
  const numericAmount = parseFloat(data.amount);
  if (isNaN(numericAmount)) {
    console.warn('trackDepositCompleted: invalid amount format:', data.amount);
    return;
  }

  pushToGTM({
    event: 'deposit_completed',
    user_id: data.user_id,
    safe_address: data.safe_address,
    amount: numericAmount.toString(),
    deposit_type: data.deposit_type,
    deposit_method: data.deposit_method,
    chain_id: data.chain_id,
    is_first_deposit: data.is_first_deposit,
  });
};

export const trackDepositFailed = (data: {
  user_id?: string;
  safe_address?: string;
  amount?: string;
  deposit_type: 'connected_wallet' | 'safe_account' | 'bank_transfer';
  deposit_method: string;
  error: string;
}) => {
  pushToGTM({
    event: 'deposit_failed',
    user_id: data.user_id,
    safe_address: data.safe_address,
    amount: data.amount,
    deposit_type: data.deposit_type,
    deposit_method: data.deposit_method,
    error: data.error,
  });
};

export const trackDepositAbandoned = (data: {
  user_id?: string;
  safe_address?: string;
  amount?: string;
  deposit_type: 'connected_wallet' | 'safe_account' | 'bank_transfer';
  step: string;
}) => {
  // Validate required data
  if (!data.deposit_type || !data.step) {
    console.warn('trackDepositAbandoned missing required fields:', data);
    return;
  }

  pushToGTM({
    event: 'deposit_abandoned',
    user_id: data.user_id,
    safe_address: data.safe_address,
    amount: data.amount,
    deposit_type: data.deposit_type,
    deposit_method: data.step,
    step: data.step,
  });
};

export const trackStaked = (data: {
  user_id?: string;
  safe_address?: string;
  amount: string;
  token_symbol: string;
}) => {
  pushToGTM({
    event: 'staked',
    user_id: data.user_id,
    safe_address: data.safe_address,
    amount: data.amount,
    token_symbol: data.token_symbol,
  });
};