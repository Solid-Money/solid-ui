import '@/global.css';

import { useCallback, useEffect, useState } from 'react';
import { Appearance, AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as Font from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { ApolloProvider } from '@apollo/client/react';
import {
  MonaSans_200ExtraLight,
  MonaSans_300Light,
  MonaSans_400Regular,
  MonaSans_500Medium,
  MonaSans_600SemiBold,
  MonaSans_700Bold,
  MonaSans_800ExtraBold,
  MonaSans_900Black,
  useFonts,
} from '@expo-google-fonts/mona-sans';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import NetInfo from '@react-native-community/netinfo';
import { PortalHost } from '@rn-primitives/portal';
import * as Sentry from '@sentry/react-native';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { WagmiProvider } from 'wagmi';

import DeferredModalProviders from '@/components/DeferredModalProviders';
import AppErrorBoundary from '@/components/ErrorBoundary';
import Intercom from '@/components/Intercom/index';
import { LazyThirdwebProvider } from '@/components/LazyThirdwebProvider';
import LazyWhatsNewModal from '@/components/LazyWhatsNewModal';
import { toastProps } from '@/components/Toast';
import { TurnkeyProvider } from '@/components/TurnkeyProvider';
import { getInfoClient } from '@/graphql/clients';
import { useAttributionInitialization } from '@/hooks/useAttributionInitialization';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTrackingTransparency } from '@/hooks/useTrackingTransparency';
import { useTrackUserPlatform } from '@/hooks/useTrackUserPlatform';
import { useWhatsNew } from '@/hooks/useWhatsNew';
import { initAnalytics, track, trackScreen } from '@/lib/analytics';
import { EXPO_PUBLIC_ENVIRONMENT, isProduction } from '@/lib/config';
import { configureObserve, markAppInteractive, withObserve } from '@/lib/observe';
import { config } from '@/lib/wagmi';
import { useUserStore } from '@/store/useUserStore';

import type { ErrorBoundaryProps } from 'expo-router';

Sentry.init({
  dsn: 'https://8e2914f77c8a188a9938a9eaa0ffc0ba@o4509954049376256.ingest.us.sentry.io/4509954077949952',
  enabled: isProduction && !__DEV__,
  environment: EXPO_PUBLIC_ENVIRONMENT || 'development',
  debug: !isProduction,
  sendDefaultPii: true,

  // Performance Monitoring - configured upfront, integrations added later
  tracesSampleRate: 0.5,
  profilesSampleRate: 0.5,

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
  replaysSessionSampleRate: 0.5,
  replaysOnErrorSampleRate: 1,

  // Integrations
  integrations: [
    Sentry.mobileReplayIntegration({
      maskAllText: false, // Set to true if you want to mask sensitive text
      maskAllImages: false, // Set to true to mask images
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
  // tracePropagationTargets: [/^https:\/\/app\.solid\.xyz/],
});

// EAS Observe: native-side startup/performance metric collection begins at
// launch, so configure dispatching before the app renders.
configureObserve();

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <AppErrorBoundary {...props} />;
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Set the animation options - instant hide, no fade
SplashScreen.setOptions({
  duration: 0,
  fade: false,
});

// WhatsNew wrapper component - must be inside QueryClientProvider
// since useWhatsNew uses React Query hooks.
// Note: Only rendered when hasSelectedUser is true (see conditional render below)
// Uses LazyWhatsNewModal to defer react-native-reanimated-carousel bundle
function WhatsNewWrapper() {
  const { whatsNew, isVisible, closeWhatsNew } = useWhatsNew();

  if (!whatsNew) return null;

  return <LazyWhatsNewModal whatsNew={whatsNew} isOpen={isVisible} onClose={closeWhatsNew} />;
}

// On native, React Query's focus and online managers have no default wiring:
// `refetchOnWindowFocus` listens to `visibilitychange` (web-only) and
// `refetchOnReconnect` has no transport to detect connectivity. Without this
// bridge, a query with `refetchOnWindowFocus: true` (e.g. tokenBalances)
// never fires when the app returns from background, and queries don't recover
// after a network drop. Wire AppState → focusManager and NetInfo → onlineManager.
if (Platform.OS !== 'web') {
  focusManager.setEventListener(handleFocus => {
    const subscription = AppState.addEventListener('change', status => {
      handleFocus(status === 'active');
    });
    return () => subscription.remove();
  });

  onlineManager.setEventListener(setOnline => {
    return NetInfo.addEventListener(state => {
      setOnline(!!state.isConnected);
    });
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - garbage collect unused queries
      retry: 2,
    },
  },
});

function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [splashScreenHidden, setSplashScreenHidden] = useState(false);
  const [analyticsReady, setAnalyticsReady] = useState(false);

  const hasSelectedUser = useUserStore(state => state.users.some(u => u.selected));

  // Initialize attribution tracking automatically (handles web and mobile)
  useAttributionInitialization();

  // Push notification lifecycle: token refresh + notification tap handling
  usePushNotifications();

  // Record platform (ios/android/web) on the user once per session
  useTrackUserPlatform();

  // App Tracking Transparency (iOS only)
  const {
    isReady: attReady,
    hasChecked: attChecked,
    isTrackingAllowed,
    status: attStatus,
    requestPermission,
  } = useTrackingTransparency();

  useEffect(() => {
    if (!splashScreenHidden) return;
    if (Platform.OS === 'ios' && !attReady) return;

    initAnalytics(isTrackingAllowed)
      .catch(e => console.warn('Analytics init error:', e))
      .finally(() => setAnalyticsReady(true));
  }, [splashScreenHidden, attReady, isTrackingAllowed]);

  useEffect(() => {
    if (!splashScreenHidden || !attChecked) return;
    if (Platform.OS !== 'ios' || attStatus !== 'undetermined') return;

    const timer = setTimeout(async () => {
      const granted = await requestPermission();
      track('ATT_Response', { status: granted ? 'granted' : 'denied' });
    }, 5000);

    return () => clearTimeout(timer);
  }, [splashScreenHidden, attChecked, attStatus, requestPermission]);

  // Load only critical font weights to speed up FCP
  // Regular (400) and SemiBold (600) cover most UI text
  const [criticalFontsLoaded, fontError] = useFonts({
    MonaSans_400Regular,
    MonaSans_600SemiBold,
  });

  // Load remaining font weights after first paint (deferred)
  useEffect(() => {
    if (criticalFontsLoaded) {
      // Defer non-critical font loading to not block render
      Font.loadAsync({
        MonaSans_200ExtraLight,
        MonaSans_300Light,
        MonaSans_500Medium,
        MonaSans_700Bold,
        MonaSans_800ExtraBold,
        MonaSans_900Black,
      }).catch(e => console.warn('Error loading secondary fonts:', e));
    }
  }, [criticalFontsLoaded]);
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  useEffect(() => {
    // Only run on Web and only in production
    if (Platform.OS === 'web' && isProduction) {
      injectSpeedInsights();
    }
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make any API calls you need to do here
        // await Font.loadAsync(Entypo.font);

        if (Platform.OS !== 'web') {
          Appearance.setColorScheme('dark');
        }

        // Add any additional initialization here
        // await initializeApp();
      } catch (e) {
        console.warn('Error during app initialization:', e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && !splashScreenHidden) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setAppIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      try {
        await SplashScreen.hideAsync();
        setSplashScreenHidden(true);
      } catch (error) {
        console.warn('Error hiding splash screen:', error);
      }
    }
  }, [appIsReady, splashScreenHidden]);

  // EAS Observe: record time-to-interactive once the splash screen is gone
  // and the first real frame is visible.
  useEffect(() => {
    if (splashScreenHidden) {
      markAppInteractive();
    }
  }, [splashScreenHidden]);

  // Track screen views on all platforms (web, iOS, Android)
  // trackScreen() handles platform-specific routing internally:
  // - Amplitude: tracks on all platforms
  // - Firebase: tracks on web only
  useEffect(() => {
    // Wait until analytics is initialized before tracking screen views. On
    // web the SDK has no proxy/serverUrl configured until init() runs, so an
    // early Page Viewed would be queued and flushed to the wrong endpoint (or
    // lost). Gating on analyticsReady also re-fires this effect once init
    // completes, capturing the landing screen with full attribution context.
    if (!analyticsReady) return;
    trackScreen(pathname, params);
  }, [pathname, params, analyticsReady]);

  useEffect(() => {
    if (fontError) {
      console.error('Error loading fonts:', fontError);
    }
  }, [fontError]);

  if (!appIsReady || !criticalFontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <TurnkeyProvider>
        <LazyThirdwebProvider>
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <ApolloProvider client={getInfoClient()}>
                <Intercom>
                  <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
                    <BottomSheetModalProvider>
                      {Platform.OS === 'web' && (
                        <Head>
                          <title>Solid - The Savings Super-App</title>
                        </Head>
                      )}
                      <Stack
                        screenOptions={{
                          contentStyle: {
                            backgroundColor: '#000',
                          },
                        }}
                      >
                        <Stack.Screen
                          name="(protected)"
                          options={{
                            headerShown: false,
                            animation: 'none',
                          }}
                        />
                        <Stack.Screen
                          name="overview"
                          options={{
                            headerShown: false,
                            animation: 'none',
                          }}
                        />
                        <Stack.Screen
                          name="card-onboard"
                          options={{
                            headerShown: false,
                            animation: 'none',
                          }}
                        />
                        <Stack.Screen
                          name="welcome"
                          options={{
                            headerShown: false,
                            animation: 'none',
                          }}
                        />
                        <Stack.Screen
                          name="notifications"
                          options={{
                            headerShown: false,
                            animation: 'none',
                          }}
                        />
                        <Stack.Screen
                          name="passkey-not-supported"
                          options={{
                            headerShown: false,
                            animation: 'none',
                          }}
                        />
                        <Stack.Screen
                          name="onboarding"
                          options={{
                            headerShown: false,
                            animation: 'none',
                          }}
                        />
                        <Stack.Screen
                          name="signup"
                          options={{
                            headerShown: false,
                            animation: 'none',
                          }}
                        />
                        <Stack.Screen
                          name="recovery"
                          options={{
                            headerShown: false,
                            animation: 'none',
                          }}
                        />
                      </Stack>
                      <PortalHost />
                      <DeferredModalProviders />
                      {hasSelectedUser && <WhatsNewWrapper />}
                    </BottomSheetModalProvider>
                  </GestureHandlerRootView>
                </Intercom>
              </ApolloProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </LazyThirdwebProvider>
        <Toast {...toastProps} />
      </TurnkeyProvider>
    </SafeAreaProvider>
  );
}

// withObserve wraps the layout with AppMetricsRoot so EAS Observe records
// time-to-first-render without a manual markFirstRender() call.
export default Sentry.wrap(withObserve(RootLayout));
