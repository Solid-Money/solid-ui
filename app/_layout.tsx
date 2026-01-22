import '@/global.css';

import { useCallback, useEffect, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as Font from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack, useGlobalSearchParams, usePathname } from 'expo-router';
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
import { PortalHost } from '@rn-primitives/portal';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { ChevronLeft } from 'lucide-react-native';
import { WagmiProvider } from 'wagmi';

import DeferredModalProviders from '@/components/DeferredModalProviders';
import AppErrorBoundary from '@/components/ErrorBoundary';
import { FingerprintProvider } from '@/components/FingerprintProvider';
import Intercom from '@/components/Intercom';
import { LazyThirdwebProvider } from '@/components/LazyThirdwebProvider';
import LazyWhatsNewModal from '@/components/LazyWhatsNewModal';
import { toastProps } from '@/components/Toast';
import { TurnkeyProvider } from '@/components/TurnkeyProvider';
import { Button } from '@/components/ui/button';
import { getInfoClient } from '@/graphql/clients';
import { useAttributionInitialization } from '@/hooks/useAttributionInitialization';
import { useWhatsNew } from '@/hooks/useWhatsNew';
import { initAnalytics, trackScreen } from '@/lib/analytics';
import { EXPO_PUBLIC_ENVIRONMENT, isProduction } from '@/lib/config';
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - garbage collect unused queries
      retry: 2,
    },
  },
});

export default Sentry.wrap(function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [splashScreenHidden, setSplashScreenHidden] = useState(false);

  const hasSelectedUser = useUserStore(state => state.users.some(u => u.selected));

  // Initialize attribution tracking automatically (handles web and mobile)
  useAttributionInitialization();

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

        // Fire analytics without awaiting - don't block first paint
        // Events fired before SDK ready will be buffered
        initAnalytics().catch(e => console.warn('Analytics init error:', e));

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

  // Track screen views on all platforms (web, iOS, Android)
  // trackScreen() handles platform-specific routing internally:
  // - Amplitude: tracks on all platforms
  // - Firebase: tracks on web only
  useEffect(() => {
    trackScreen(pathname, params);
  }, [pathname, params]);

  useEffect(() => {
    if (fontError) {
      console.error('Error loading fonts:', fontError);
    }
  }, [fontError]);

  if (!appIsReady || !criticalFontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <FingerprintProvider>
        <TurnkeyProvider>
          <LazyThirdwebProvider>
            <WagmiProvider config={config}>
              <QueryClientProvider client={queryClient}>
                <ApolloProvider client={getInfoClient()}>
                  <Intercom>
                    <GestureHandlerRootView>
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
                            name="welcome"
                            options={{
                              headerShown: false,
                              animation: 'none',
                            }}
                          />
                          <Stack.Screen
                            name="notifications"
                            options={{
                              animation: 'none',
                              title: 'Turn on notifications',
                              headerStyle: {
                                backgroundColor: '#000',
                              },
                              headerTintColor: '#fff',
                              headerTitleStyle: {
                                fontSize: 20,
                                fontWeight: 'bold',
                              },
                              headerLeft: () => (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onPress={() => router.back()}
                                  className="mr-4"
                                >
                                  <ChevronLeft size={28} color="white" />
                                </Button>
                              ),
                              headerTitleAlign: 'center',
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
      </FingerprintProvider>
    </SafeAreaProvider>
  );
});
