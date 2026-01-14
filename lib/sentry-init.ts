/**
 * Deferred Sentry initialization for improved FCP performance.
 *
 * Instead of running Sentry.init() at module evaluation time (blocking),
 * this module defers initialization until after the first meaningful paint
 * using requestIdleCallback (or setTimeout fallback).
 *
 * This can save ~500ms on FCP as Sentry initialization involves:
 * - Session replay setup
 * - React navigation integration
 * - Screenshot capture initialization
 * - Network request interception setup
 */
import * as Sentry from '@sentry/react-native';

let isInitialized = false;

const SENTRY_DSN =
  'https://8e2914f77c8a188a9938a9eaa0ffc0ba@o4509954049376256.ingest.us.sentry.io/4509954077949952';

/**
 * Initialize Sentry with full configuration.
 * Called after the app has rendered its first meaningful paint.
 */
const initSentry = () => {
  if (isInitialized) return;

  const isProduction = process.env.EXPO_PUBLIC_ENVIRONMENT === 'production' && !__DEV__;

  Sentry.init({
    dsn: SENTRY_DSN,

    // Only enable Sentry in production
    enabled: isProduction,

    // Set environment from env variable
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',

    // Debug logs only in non-production environments
    debug: process.env.EXPO_PUBLIC_ENVIRONMENT !== 'production',

    // Adds more context data to events (IP address, cookies, user, etc.)
    sendDefaultPii: true,

    // Performance Monitoring
    tracesSampleRate: 0.2, // Capture 20% of transactions for performance monitoring
    profilesSampleRate: 0.2, // Profile 20% of sampled transactions

    // Release Health
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000, // 30 seconds

    // Error Filtering
    ignoreErrors: [
      // Network errors that are usually not actionable
      'Network request failed',
      'NetworkError',
      'Failed to fetch',
      // User canceled actions
      'AbortError',
      // Common React Native warnings in dev
      'Non-serializable values were found in the navigation state',
    ],

    // Breadcrumbs
    maxBreadcrumbs: 100,
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      return breadcrumb;
    },

    // Sample events before sending
    beforeSend(event) {
      // Filter out events from development if they somehow get through
      if (event.environment !== 'production') {
        return null;
      }

      // Sanitize sensitive data
      if (event.request?.cookies) {
        delete event.request.cookies;
      }

      return event;
    },

    // Configure Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,

    // Integrations
    integrations: [
      Sentry.mobileReplayIntegration({
        maskAllText: false,
        maskAllImages: false,
      }),
      Sentry.feedbackIntegration(),
      Sentry.reactNativeTracingIntegration(),
      Sentry.reactNavigationIntegration({
        routeChangeTimeoutMs: 50,
      }),
    ],

    // Attachments
    attachScreenshot: true,
    attachViewHierarchy: true,

    // Network tracking
    tracePropagationTargets: [
      // Only trace requests to your own backend
      /^https:\/\/.*\.solid\.xyz/,
    ],
  });

  isInitialized = true;
};

/**
 * Schedule Sentry initialization to run when the browser is idle.
 * Uses requestIdleCallback for optimal timing, falls back to setTimeout.
 *
 * This ensures Sentry loads AFTER the first contentful paint,
 * improving perceived performance without losing error tracking.
 */
export const initSentryDeferred = () => {
  // Skip in development
  if (__DEV__) return;

  if (typeof requestIdleCallback !== 'undefined') {
    // Browser supports requestIdleCallback - run when idle
    requestIdleCallback(
      () => {
        initSentry();
      },
      { timeout: 5000 }, // Fallback after 5s if browser stays busy
    );
  } else {
    // Fallback for environments without requestIdleCallback (React Native)
    setTimeout(initSentry, 2000);
  }
};

/**
 * Get whether Sentry has been initialized.
 * Useful for components that need to conditionally use Sentry features.
 */
export const isSentryInitialized = () => isInitialized;

/**
 * Re-export Sentry's wrap function for the root component.
 * This is safe to use before initialization - Sentry handles this gracefully.
 */
export const wrapWithSentry = Sentry.wrap;
