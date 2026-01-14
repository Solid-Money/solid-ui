/**
 * Hybrid Sentry initialization for both early error tracking and performance.
 *
 * Phase 1 (Immediate): Full Sentry init with all configuration but no heavy integrations
 * - Catches early JavaScript errors, module initialization errors, React render errors
 * - All sampling rates and options configured upfront
 *
 * Phase 2 (Deferred): Add heavy integrations via Sentry.addIntegration()
 * - Session replay, performance monitoring, navigation tracking
 * - Runs after first meaningful paint via requestIdleCallback
 *
 * This approach avoids calling Sentry.init() twice, which can cause:
 * - Duplicate events being sent
 * - Memory leaks from duplicate integrations
 * - Unpredictable behavior in error tracking
 */
import * as Sentry from '@sentry/react-native';

let isInitialized = false;
let areIntegrationsAdded = false;

const SENTRY_DSN =
  'https://8e2914f77c8a188a9938a9eaa0ffc0ba@o4509954049376256.ingest.us.sentry.io/4509954077949952';

const isProduction = process.env.EXPO_PUBLIC_ENVIRONMENT === 'production' && !__DEV__;

/**
 * Phase 1: Initialize Sentry with full configuration but minimal integrations.
 * This runs synchronously at module load to catch early errors.
 * Heavy integrations are added later via addIntegration().
 */
const initSentry = () => {
  if (isInitialized || __DEV__) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: isProduction,
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',
    debug: process.env.EXPO_PUBLIC_ENVIRONMENT !== 'production',
    sendDefaultPii: true,

    // Performance Monitoring - configured upfront, integrations added later
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

    // Configure Session Replay - rates set upfront, integration added later
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,

    // Start with no heavy integrations - they'll be added via addIntegration()
    integrations: [],

    // Attachments
    attachScreenshot: true,
    attachViewHierarchy: true,

    // Network tracking
    tracePropagationTargets: [/^https:\/\/app\.solid\.xyz/],
  });

  isInitialized = true;
};

// Initialize Sentry immediately (synchronously)
initSentry();

/**
 * Phase 2: Add heavy integrations after the app has rendered.
 * Uses Sentry.addIntegration() instead of re-calling init().
 */
const addDeferredIntegrations = () => {
  if (areIntegrationsAdded || !isInitialized) return;

  // Add each integration individually using the proper API
  Sentry.addIntegration(
    Sentry.mobileReplayIntegration({
      maskAllText: false,
      maskAllImages: false,
    }),
  );

  Sentry.addIntegration(Sentry.feedbackIntegration());

  Sentry.addIntegration(Sentry.reactNativeTracingIntegration());

  Sentry.addIntegration(
    Sentry.reactNavigationIntegration({
      routeChangeTimeoutMs: 50,
    }),
  );

  areIntegrationsAdded = true;
};

/**
 * Schedule adding heavy Sentry integrations when the browser is idle.
 * Uses requestIdleCallback for optimal timing, falls back to setTimeout.
 *
 * This ensures heavy integrations load AFTER the first contentful paint,
 * improving perceived performance without losing error tracking.
 */
export const initSentryDeferred = () => {
  // Skip in development
  if (__DEV__) return;

  if (typeof requestIdleCallback !== 'undefined') {
    // Browser supports requestIdleCallback - run when idle
    requestIdleCallback(
      () => {
        addDeferredIntegrations();
      },
      { timeout: 5000 }, // Fallback after 5s if browser stays busy
    );
  } else {
    // Fallback for environments without requestIdleCallback (React Native)
    setTimeout(addDeferredIntegrations, 2000);
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
