import { EXPO_PUBLIC_FINGERPRINT_API_KEY, EXPO_PUBLIC_FINGERPRINT_REGION } from '@/lib/config';

/**
 * Fingerprint.com integration for device intelligence and fraud prevention.
 *
 * This module provides shared types and configuration for Fingerprint.
 * Platform-specific implementations are in:
 * - hooks/useFingerprint.native.ts (iOS/Android)
 * - hooks/useFingerprint.web.ts (Web)
 *
 * @see https://dev.fingerprint.com/docs/native-mobile-sdks
 * @see https://dev.fingerprint.com/docs/js-agent
 */

// Re-export types for convenience
export type FingerprintRegion = 'us' | 'eu' | 'ap';

export interface FingerprintConfig {
  apiKey: string;
  region: FingerprintRegion;
}

export interface VisitorData {
  visitorId: string;
  requestId: string;
  confidence: {
    score: number;
  };
}

/**
 * Get the Fingerprint configuration from environment variables.
 * Returns null if not configured (e.g., in development without keys).
 */
export function getFingerprintConfig(): FingerprintConfig | null {
  const apiKey = EXPO_PUBLIC_FINGERPRINT_API_KEY;
  const region = (EXPO_PUBLIC_FINGERPRINT_REGION || 'us') as FingerprintRegion;

  if (!apiKey) {
    if (__DEV__) {
      console.warn('[Fingerprint] API key not configured - device verification will be skipped');
    }
    return null;
  }

  return { apiKey, region };
}

/**
 * Get the Fingerprint API endpoint URL based on region.
 */
export function getFingerprintEndpoint(region: FingerprintRegion): string {
  switch (region) {
    case 'eu':
      return 'https://eu.api.fpjs.io';
    case 'ap':
      return 'https://ap.api.fpjs.io';
    default:
      return 'https://api.fpjs.io';
  }
}
