import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  type AttributionChannel,
  type AttributionValidationResult,
  formatAttributionForLogging,
  getAttributionChannel,
  getCurrentURL,
  getReferrer,
  validateAttribution,
} from '@/lib/attribution';
import { type AttributionData, useAttributionStore } from '@/store/useAttributionStore';

export interface UseAttributionReturn {
  // Current attribution data
  attribution: AttributionData;
  attributionChannel: AttributionChannel;
  isReady: boolean;
  hasAttribution: boolean;

  // Validation
  validation: AttributionValidationResult | null;

  // Actions
  initializeAttribution: () => Promise<void>;
  refreshAttribution: () => Promise<void>;
  captureAttribution: (url?: string) => Promise<AttributionData | null>;
  trackEventWithAttribution: (eventName: string, params?: Record<string, any>) => void;
  clearAttribution: () => void;

  // Utilities
  getAttributionSummary: () => string;
  isAttributionExpired: (windowDays?: number) => boolean;
}

/**
 * React hook for managing attribution tracking
 * Provides initialization, capture, and tracking functionality
 */
export const useAttribution = (): UseAttributionReturn => {
  const attributionStore = useAttributionStore();
  const [isReady, setIsReady] = useState(false);
  const [validation, setValidation] = useState<AttributionValidationResult | null>(null);
  const hasInitialized = useRef(false);

  // Get current attribution data
  const attribution = attributionStore.attributionData;
  const hasAttribution = attributionStore.hasAttribution();
  const attributionChannel = getAttributionChannel(attribution);

  /**
   * Initialize attribution tracking on app launch
   * Captures URL parameters, referrer, and sets up tracking
   */
  const initializeAttribution = useCallback(async () => {
    if (hasInitialized.current) {
      console.warn('Attribution already initialized, skipping');
      return;
    }

    try {
      console.warn('Initializing attribution tracking...');

      // Capture attribution from current context
      if (Platform.OS === 'web') {
        // Web: Capture from URL and referrer
        const currentUrl = getCurrentURL();
        const referrer = getReferrer();

        if (currentUrl) {
          const captured = attributionStore.captureFromURL(currentUrl);

          // Add referrer if we captured attribution
          if (captured && referrer) {
            attributionStore.updateAttribution({
              landing_page_referrer: referrer,
            });
          }

          if (captured) {
            console.warn(
              'Attribution captured on initialization:',
              formatAttributionForLogging(captured),
            );
          }
        }
      } else {
        // Mobile: Attribution will be captured from deep links
        console.warn('Mobile platform - attribution will be captured from deep links');
      }

      // Validate attribution data
      const validationResult = validateAttribution(attributionStore.attributionData);
      setValidation(validationResult);

      if (validationResult.warnings.length > 0) {
        console.warn('Attribution validation warnings:', validationResult.warnings);
      }

      hasInitialized.current = true;
      setIsReady(true);

      console.warn('Attribution initialization complete');
    } catch (error) {
      console.error('Failed to initialize attribution:', error);
      Sentry.captureException(error, {
        tags: { type: 'attribution_init_error' },
        level: 'error',
      });
      setIsReady(true); // Set ready even on error to avoid blocking
    }
  }, [attributionStore]);

  /**
   * Refresh attribution data (re-capture from URL if available)
   */
  const refreshAttribution = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const currentUrl = getCurrentURL();
        if (currentUrl) {
          const captured = attributionStore.captureFromURL(currentUrl);
          if (captured) {
            console.warn('Attribution refreshed:', formatAttributionForLogging(captured));

            // Re-validate
            const validationResult = validateAttribution(attributionStore.attributionData);
            setValidation(validationResult);
          }
        }
      }
    } catch (error) {
      console.error('Failed to refresh attribution:', error);
      Sentry.captureException(error, {
        tags: { type: 'attribution_refresh_error' },
        level: 'warning',
      });
    }
  }, [attributionStore]);

  /**
   * Manually capture attribution from a URL
   * Useful for handling deep links or custom navigation
   */
  const captureAttribution = useCallback(
    async (url?: string): Promise<AttributionData | null> => {
      try {
        const targetUrl = url || getCurrentURL();
        if (!targetUrl) return null;

        const captured = attributionStore.captureFromURL(targetUrl);

        if (captured) {
          console.warn('Attribution manually captured:', formatAttributionForLogging(captured));

          // Update validation
          const validationResult = validateAttribution(attributionStore.attributionData);
          setValidation(validationResult);

          return captured;
        }

        return null;
      } catch (error) {
        console.error('Failed to capture attribution:', error);
        Sentry.captureException(error, {
          tags: { type: 'attribution_capture_error' },
          level: 'warning',
          extra: { url },
        });
        return null;
      }
    },
    [attributionStore],
  );

  /**
   * Track an event with attribution data automatically included
   * This is a convenience method - actual tracking should use analytics.ts
   */
  const trackEventWithAttribution = useCallback(
    (eventName: string, params: Record<string, any> = {}) => {
      try {
        const attributionData = attributionStore.getAttributionForEvent();

        // Import and call the actual track function
        // This is a placeholder - the real implementation will be in analytics.ts
        console.warn(`Tracking event: ${eventName} with attribution:`, {
          ...params,
          ...attributionData,
          attribution_channel: attributionChannel,
        });
      } catch (error) {
        console.error('Failed to track event with attribution:', error);
      }
    },
    [attributionStore, attributionChannel],
  );

  /**
   * Clear all attribution data
   */
  const clearAttribution = useCallback(() => {
    attributionStore.clearAttribution();
    setValidation(null);
    hasInitialized.current = false;
    setIsReady(false);
  }, [attributionStore]);

  /**
   * Get human-readable attribution summary
   */
  const getAttributionSummary = useCallback((): string => {
    return formatAttributionForLogging(attribution);
  }, [attribution]);

  /**
   * Check if attribution has expired
   */
  const isAttributionExpired = useCallback(
    (windowDays: number = 30): boolean => {
      return attributionStore.isAttributionExpired(windowDays);
    },
    [attributionStore],
  );

  return {
    // State
    attribution,
    attributionChannel,
    isReady,
    hasAttribution,
    validation,

    // Actions
    initializeAttribution,
    refreshAttribution,
    captureAttribution,
    trackEventWithAttribution,
    clearAttribution,

    // Utilities
    getAttributionSummary,
    isAttributionExpired,
  };
};

/**
 * Hook specifically for deep link attribution (mobile)
 * Separate hook to keep concerns separated
 */
export const useDeepLinkAttribution = () => {
  const attributionStore = useAttributionStore();

  const captureFromDeepLink = useCallback(
    (deepLinkUrl: string): AttributionData | null => {
      try {
        const captured = attributionStore.captureFromDeepLink(deepLinkUrl);

        if (captured) {
          console.warn('Deep link attribution captured:', formatAttributionForLogging(captured));
        }

        return captured;
      } catch (error) {
        console.error('Failed to capture deep link attribution:', error);
        Sentry.captureException(error, {
          tags: { type: 'deeplink_attribution_error' },
          level: 'warning',
          extra: { deepLinkUrl },
        });
        return null;
      }
    },
    [attributionStore],
  );

  return {
    captureFromDeepLink,
    hasAttribution: attributionStore.hasAttribution(),
    attribution: attributionStore.attributionData,
  };
};

/**
 * Hook for monitoring attribution health
 * Useful for debugging and monitoring dashboards
 */
export const useAttributionHealth = () => {
  const attributionStore = useAttributionStore();
  const [healthMetrics, setHealthMetrics] = useState({
    hasAttribution: false,
    completeness: 0,
    isExpired: false,
    channel: 'direct' as AttributionChannel,
    warnings: [] as string[],
  });

  useEffect(() => {
    const attribution = attributionStore.attributionData;
    const validation = validateAttribution(attribution);

    setHealthMetrics({
      hasAttribution: attributionStore.hasAttribution(),
      completeness: validation.completeness,
      isExpired: attributionStore.isAttributionExpired(),
      channel: getAttributionChannel(attribution),
      warnings: validation.warnings,
    });
  }, [attributionStore.attributionData, attributionStore]);

  return healthMetrics;
};
