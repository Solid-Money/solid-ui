import { useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react-native';

/** Time window in ms for counting renders */
const RENDER_WINDOW_MS = 1000;

/** Cooldown period between warning messages to prevent spam */
const WARN_COOLDOWN_MS = 60000; // 1 minute

interface RenderMonitorOptions {
  /** Component name for identification in Sentry breadcrumbs */
  componentName: string;
  /** Threshold for render count warning (default: 10 renders per second) */
  warnThreshold?: number;
  /** Whether to track in development mode (default: false) */
  trackInDev?: boolean;
}

/**
 * Hook to monitor component render counts and report to Sentry.
 * Helps catch infinite re-render regressions early.
 *
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   useRenderMonitor({ componentName: 'MyComponent' });
 *   // ... rest of component
 * };
 * ```
 */
export const useRenderMonitor = ({
  componentName,
  warnThreshold = 10,
  trackInDev = false,
}: RenderMonitorOptions) => {
  const renderCountRef = useRef(0);
  const lastResetTimeRef = useRef(Date.now());
  const lastWarnTimeRef = useRef(0);

  // Determine if monitoring is active (safe to compute during render)
  const isActive = !__DEV__ || trackInDev;

  // Increment render count on each render (ref mutation is safe during render)
  if (isActive) {
    renderCountRef.current += 1;
  }

  // Use effect for Sentry API calls to avoid side effects during render
  useEffect(() => {
    if (!isActive) return;

    const now = Date.now();
    const timeSinceReset = now - lastResetTimeRef.current;

    // Check and report every second
    if (timeSinceReset >= RENDER_WINDOW_MS) {
      const currentRenderCount = renderCountRef.current;

      // Log breadcrumb if we had multiple renders in this period
      if (currentRenderCount > 1) {
        Sentry.addBreadcrumb({
          category: 'render',
          message: `${componentName} rendered ${currentRenderCount} times`,
          level: currentRenderCount > warnThreshold ? 'warning' : 'info',
          data: {
            component: componentName,
            renderCount: currentRenderCount,
            periodMs: timeSinceReset,
          },
        });
      }

      // Check if we exceeded threshold and cooldown has passed
      const timeSinceLastWarn = now - lastWarnTimeRef.current;
      if (currentRenderCount > warnThreshold && timeSinceLastWarn > WARN_COOLDOWN_MS) {
        lastWarnTimeRef.current = now;

        // Capture a warning message to Sentry
        Sentry.captureMessage(`Excessive renders detected in ${componentName}`, {
          level: 'warning',
          tags: {
            component: componentName,
            issue: 'excessive_renders',
          },
          extra: {
            renderCount: currentRenderCount,
            threshold: warnThreshold,
            periodMs: timeSinceReset,
          },
        });

        // Also log to console in development
        if (__DEV__) {
          console.warn(
            `[RenderMonitor] ${componentName} rendered ${currentRenderCount} times in ${timeSinceReset}ms (threshold: ${warnThreshold})`,
          );
        }
      }

      // Reset counters
      renderCountRef.current = 0;
      lastResetTimeRef.current = now;
    }
  });

  // Cleanup: report pending renders on unmount
  useEffect(() => {
    return () => {
      if (!isActive) return;

      const pendingRenders = renderCountRef.current;
      if (pendingRenders > 1) {
        Sentry.addBreadcrumb({
          category: 'render',
          message: `${componentName} unmounted with ${pendingRenders} pending renders`,
          level: 'info',
          data: {
            component: componentName,
            renderCount: pendingRenders,
          },
        });
      }
    };
  }, [componentName, isActive]);
};

/**
 * List of critical components that should be monitored.
 * These are components that previously had or are susceptible to re-render issues.
 */
export const MONITORED_COMPONENTS = {
  // Main screens
  HOME_SCREEN: 'HomeScreen',
  SAVINGS_SCREEN: 'SavingsScreen',
  ACTIVITY_SCREEN: 'ActivityScreen',
} as const;

/** Type for monitored component names */
export type MonitoredComponent = (typeof MONITORED_COMPONENTS)[keyof typeof MONITORED_COMPONENTS];
