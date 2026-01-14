/**
 * Hybrid Sentry initialization for both early error tracking and performance.
 *
 * Phase 1 (Immediate): Minimal Sentry init with just error capture
 * - Catches early JavaScript errors, module initialization errors, React render errors
 * - No heavy integrations (replay, tracing, navigation)
 *
 * Phase 2 (Deferred): Full initialization with all integrations
 * - Session replay, performance monitoring, navigation tracking
 * - Runs after first meaningful paint via requestIdleCallback
 */
import * as Sentry from '@sentry/react-native';

let isMinimalInitialized = false;
let isFullyInitialized = false;

const SENTRY_DSN =
  'https://8e2914f77c8a188a9938a9eaa0ffc0ba@o4509954049376256.ingest.us.sentry.io/4509954077949952';

const isProduction = process.env.EXPO_PUBLIC_ENVIRONMENT === 'production' && !__DEV__;

/**
 * Phase 1: Minimal Sentry initialization for immediate error capture.
 * This runs synchronously at module load to catch early errors.
 */
const initSentryMinimal = () => {
  if (isMinimalInitialized || __DEV__) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: isProduction,
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',

    // Minimal config - just error capture, no heavy integrations
    integrations: [],

    // Error Filtering
    ignoreErrors: [
      'Network request failed',
      'NetworkError',
      'Failed to fetch',
      'AbortError',
      'Non-serializable values were found in the navigation state',
    ],

    // Sample events before sending
    beforeSend(event) {
      if (event.environment !== 'production') {
        return null;
      }
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      return event;
    },
  });

  isMinimalInitialized = true;
};

// Initialize minimal Sentry immediately (synchronously)
initSentryMinimal();

/**
 * Phase 2: Full Sentry initialization with all integrations.
 * Called after the app has rendered its first meaningful paint.
 */
const initSentryFull = () => {
  if (isFullyInitialized || !isMinimalInitialized) return;

  // Re-initialize with full configuration
  // Sentry.init() can be called again to add integrations
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: isProduction,
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',
    debug: process.env.EXPO_PUBLIC_ENVIRONMENT !== 'production',
    sendDefaultPii: true,

    // Performance Monitoring
    tracesSampleRate: 0.2,
    profilesSampleRate: 0.2,

    // Release Health
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,

    // Error Filtering
    ignoreErrors: [
      'Network request failed',
      'NetworkError',
      'Failed to fetch',
      'AbortError',
      'Non-serializable values were found in the navigation state',
    ],

    // Breadcrumbs
    maxBreadcrumbs: 100,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      return breadcrumb;
    },

    beforeSend(event) {
      if (event.environment !== 'production') {
        return null;
      }
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      return event;
    },

    // Configure Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,

    // Full integrations (heavy)
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
    tracePropagationTargets: [/^https:\/\/app\.solid\.xyz/],
  });

  isFullyInitialized = true;
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
        initSentryFull();
      },
      { timeout: 5000 }, // Fallback after 5s if browser stays busy
    );
  } else {
    // Fallback for environments without requestIdleCallback (React Native)
    setTimeout(initSentryFull, 2000);
  }
};

/**
 * Get whether Sentry has been initialized.
 * Useful for components that need to conditionally use Sentry features.
 */
export const isSentryInitialized = () => isMinimalInitialized;

/**
 * Re-export Sentry's wrap function for the root component.
 * This is safe to use before initialization - Sentry handles this gracefully.
 */
export const wrapWithSentry = Sentry.wrap;
