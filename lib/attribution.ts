import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

import type { AttributionData } from '@/store/useAttributionStore';

/**
 * Attribution utility functions for parsing and managing marketing attribution data
 */

/**
 * Parse UTM parameters and advertising IDs from URL
 */
export const parseAttributionFromURL = (url: string): Partial<AttributionData> => {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    const attribution: Partial<AttributionData> = {};

    // UTM parameters (standard marketing attribution)
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const utmContent = params.get('utm_content');
    const utmTerm = params.get('utm_term');

    if (utmSource) attribution.utm_source = utmSource.trim();
    if (utmMedium) attribution.utm_medium = utmMedium.trim();
    if (utmCampaign) attribution.utm_campaign = utmCampaign.trim();
    if (utmContent) attribution.utm_content = utmContent.trim();
    if (utmTerm) attribution.utm_term = utmTerm.trim();

    // Advertising platform click IDs
    const gclid = params.get('gclid'); // Google Ads
    const fbclid = params.get('fbclid'); // Facebook Ads
    const msclkid = params.get('msclkid'); // Microsoft Ads
    const ttclid = params.get('ttclid'); // TikTok Ads

    if (gclid) attribution.gclid = gclid.trim();
    if (fbclid) attribution.fbclid = fbclid.trim();
    if (msclkid) attribution.msclkid = msclkid.trim();
    if (ttclid) attribution.ttclid = ttclid.trim();

    // Referral codes (support multiple parameter names for compatibility)
    const refCode =
      params.get('ref') ||
      params.get('refCode') ||
      params.get('referralCode') ||
      params.get('referral');

    if (refCode) {
      attribution.referral_code = refCode.trim();
      attribution.referral_source = 'url';
    }

    // Landing page information
    attribution.landing_page = url;
    attribution.landing_page_path = urlObj.pathname;

    // Add timestamp
    attribution.attribution_captured_at = Date.now();

    return attribution;
  } catch (error) {
    console.warn('Failed to parse attribution from URL:', error);
    Sentry.captureException(error, {
      tags: { type: 'attribution_url_parse_error' },
      level: 'warning',
      extra: { url },
    });
    return {};
  }
};

/**
 * Parse attribution from deep link URL (iOS Universal Links, Android App Links)
 */
export const parseAttributionFromDeepLink = (deepLinkUrl: string): Partial<AttributionData> => {
  try {
    // Deep links use custom schemes (e.g., 'solid://') or universal links
    // Parse them the same way as regular URLs
    const attribution = parseAttributionFromURL(deepLinkUrl);

    // Mark referral source as deeplink if present
    if (attribution.referral_code) {
      attribution.referral_source = 'deeplink';
    }

    return attribution;
  } catch (error) {
    console.warn('Failed to parse attribution from deep link:', error);
    Sentry.captureException(error, {
      tags: { type: 'attribution_deeplink_parse_error' },
      level: 'warning',
      extra: { deepLinkUrl },
    });
    return {};
  }
};

/**
 * Get current URL for web platform
 */
export const getCurrentURL = (): string | null => {
  if (Platform.OS !== 'web') return null;

  try {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.href;
    }
  } catch (error) {
    console.warn('Failed to get current URL:', error);
  }

  return null;
};

/**
 * Get HTTP referrer for web platform
 */
export const getReferrer = (): string | null => {
  if (Platform.OS !== 'web') return null;

  try {
    if (typeof document !== 'undefined' && document.referrer) {
      return document.referrer;
    }
  } catch (error) {
    console.warn('Failed to get referrer:', error);
  }

  return null;
};

/**
 * Validate attribution data for completeness and quality
 */
export interface AttributionValidationResult {
  isValid: boolean;
  hasSource: boolean;
  hasCampaign: boolean;
  hasReferral: boolean;
  hasClickId: boolean;
  completeness: number; // 0-100% score
  warnings: string[];
}

export const validateAttribution = (
  data: Partial<AttributionData>,
): AttributionValidationResult => {
  const warnings: string[] = [];

  // Check for presence of key attribution fields
  const hasSource = !!data.utm_source;
  const hasCampaign = !!data.utm_campaign;
  const hasReferral = !!data.referral_code;
  const hasClickId = !!(data.gclid || data.fbclid || data.msclkid || data.ttclid);

  // Calculate completeness score
  let completeness = 0;
  const fields = [
    data.utm_source,
    data.utm_medium,
    data.utm_campaign,
    data.utm_content,
    data.utm_term,
    data.referral_code,
    data.gclid || data.fbclid || data.msclkid || data.ttclid,
    data.landing_page,
  ];

  const presentFields = fields.filter(field => !!field).length;
  completeness = Math.round((presentFields / fields.length) * 100);

  // Validation warnings
  if (hasSource && !hasCampaign) {
    warnings.push('utm_source present but utm_campaign missing');
  }

  if (hasCampaign && !hasSource) {
    warnings.push('utm_campaign present but utm_source missing');
  }

  if (data.utm_source && data.utm_source.length > 100) {
    warnings.push('utm_source suspiciously long (>100 chars)');
  }

  if (data.utm_campaign && data.utm_campaign.length > 100) {
    warnings.push('utm_campaign suspiciously long (>100 chars)');
  }

  // Check for potential tracking issues
  if (data.utm_source?.toLowerCase() === 'direct') {
    warnings.push('utm_source is "direct" - may indicate attribution loss');
  }

  const isValid = (hasSource && hasCampaign) || hasReferral || hasClickId || completeness >= 25;

  return {
    isValid,
    hasSource,
    hasCampaign,
    hasReferral,
    hasClickId,
    completeness,
    warnings,
  };
};

/**
 * Merge attribution data with precedence rules
 * First-touch data takes precedence for source/campaign
 * Last-touch data takes precedence for content/term
 */
export const mergeAttribution = (
  firstTouch: Partial<AttributionData>,
  lastTouch: Partial<AttributionData>,
): AttributionData => {
  return {
    // First-touch takes precedence for source and campaign (never change initial attribution)
    utm_source: firstTouch.utm_source || lastTouch.utm_source,
    utm_campaign: firstTouch.utm_campaign || lastTouch.utm_campaign,
    utm_medium: firstTouch.utm_medium || lastTouch.utm_medium,

    // Last-touch takes precedence for content and term (reflects most recent messaging)
    utm_content: lastTouch.utm_content || firstTouch.utm_content,
    utm_term: lastTouch.utm_term || firstTouch.utm_term,

    // Click IDs - prefer last-touch (most recent ad click)
    gclid: lastTouch.gclid || firstTouch.gclid,
    fbclid: lastTouch.fbclid || firstTouch.fbclid,
    msclkid: lastTouch.msclkid || firstTouch.msclkid,
    ttclid: lastTouch.ttclid || firstTouch.ttclid,

    // Referral - prefer first-touch (who originally referred the user)
    referral_code: firstTouch.referral_code || lastTouch.referral_code,
    referral_source: firstTouch.referral_source || lastTouch.referral_source,

    // Timestamps
    first_visit_timestamp: firstTouch.first_visit_timestamp || lastTouch.first_visit_timestamp,
    last_visit_timestamp: lastTouch.last_visit_timestamp || firstTouch.last_visit_timestamp,
    attribution_captured_at:
      lastTouch.attribution_captured_at || firstTouch.attribution_captured_at,

    // Device IDs - prefer last-touch (most recent session)
    anonymous_device_id: lastTouch.anonymous_device_id || firstTouch.anonymous_device_id,
    amplitude_device_id: lastTouch.amplitude_device_id || firstTouch.amplitude_device_id,
    amplitude_session_id: lastTouch.amplitude_session_id || firstTouch.amplitude_session_id,

    // Landing page - prefer first-touch (initial entry point)
    landing_page: firstTouch.landing_page || lastTouch.landing_page,
    landing_page_path: firstTouch.landing_page_path || lastTouch.landing_page_path,
    landing_page_referrer: firstTouch.landing_page_referrer || lastTouch.landing_page_referrer,

    // Attribution type
    attribution_type: 'multi_touch',
  };
};

/**
 * Check if attribution data has expired based on attribution window
 * Standard marketing attribution windows: 7, 30, 60, 90 days
 */
export const isAttributionExpired = (
  attributionData: Partial<AttributionData>,
  windowDays: number = 30,
): boolean => {
  if (!attributionData.first_visit_timestamp) return true;

  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const ageMs = now - attributionData.first_visit_timestamp;

  return ageMs > windowMs;
};

/**
 * Get attribution source category for reporting
 * Categorizes attribution sources into broad channels
 */
export type AttributionChannel =
  | 'organic'
  | 'paid_search'
  | 'paid_social'
  | 'social'
  | 'email'
  | 'referral'
  | 'direct'
  | 'other';

export const getAttributionChannel = (data: Partial<AttributionData>): AttributionChannel => {
  // Referral code takes precedence
  if (data.referral_code) return 'referral';

  // Click IDs indicate paid advertising
  if (data.gclid || data.msclkid) return 'paid_search';
  if (data.fbclid || data.ttclid) return 'paid_social';

  // UTM medium categorization
  if (data.utm_medium) {
    const medium = data.utm_medium.toLowerCase();

    if (medium.includes('cpc') || medium.includes('ppc') || medium.includes('paid')) {
      // Check source to determine search vs social
      const source = data.utm_source?.toLowerCase() || '';
      if (source.includes('google') || source.includes('bing') || source.includes('search')) {
        return 'paid_search';
      }
      if (
        source.includes('facebook') ||
        source.includes('twitter') ||
        source.includes('instagram') ||
        source.includes('linkedin') ||
        source.includes('tiktok')
      ) {
        return 'paid_social';
      }
    }

    if (medium.includes('social') || medium.includes('organic_social')) return 'social';
    if (medium.includes('email')) return 'email';
    if (medium.includes('organic')) return 'organic';
  }

  // UTM source categorization as fallback
  if (data.utm_source) {
    const source = data.utm_source.toLowerCase();

    if (
      source.includes('google') ||
      source.includes('bing') ||
      source.includes('search') ||
      source.includes('seo')
    ) {
      return 'organic';
    }

    if (
      source.includes('facebook') ||
      source.includes('twitter') ||
      source.includes('instagram') ||
      source.includes('linkedin') ||
      source.includes('tiktok')
    ) {
      return 'social';
    }

    if (source.includes('email') || source.includes('newsletter')) {
      return 'email';
    }

    if (source === 'direct' || source === '(direct)') {
      return 'direct';
    }
  }

  // Default to 'other' if we can't categorize
  return data.utm_source || data.utm_campaign ? 'other' : 'direct';
};

/**
 * Sanitize attribution value to remove potential PII
 * Checks for emails, phone numbers, and other sensitive patterns
 */
export const sanitizeAttributionValue = (value: string): string | null => {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Check for PII patterns
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const ssnPattern = /\d{3}-\d{2}-\d{4}/;

  if (emailPattern.test(trimmed) || phonePattern.test(trimmed) || ssnPattern.test(trimmed)) {
    console.warn('PII detected in attribution value, removing:', value.substring(0, 10) + '...');
    return null;
  }

  return trimmed;
};

/**
 * Format attribution data for logging (safe for logs)
 */
export const formatAttributionForLogging = (data: Partial<AttributionData>): string => {
  const parts: string[] = [];

  if (data.utm_source) parts.push(`source:${data.utm_source}`);
  if (data.utm_medium) parts.push(`medium:${data.utm_medium}`);
  if (data.utm_campaign) parts.push(`campaign:${data.utm_campaign}`);
  if (data.referral_code) parts.push(`referral:${data.referral_code}`);
  if (data.gclid) parts.push('gclid:***');
  if (data.fbclid) parts.push('fbclid:***');

  const channel = getAttributionChannel(data);
  parts.push(`channel:${channel}`);

  return parts.join(' | ');
};
