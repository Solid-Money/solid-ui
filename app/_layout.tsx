import CardDepositModalProvider from '@/components/Card/CardDepositModalProvider';
import DepositFromSafeAccountModalProvider from '@/components/Deposit/DepositFromSafeAccountModalProvider';
import DepositModalProvider from '@/components/DepositOption/DepositModalProvider';
import AppErrorBoundary from '@/components/ErrorBoundary';
import Intercom from '@/components/Intercom';
import SendModalProvider from '@/components/Send/SendModalProvider';
import StakeModalProvider from '@/components/Stake/StakeModalProvider';
import SwapModalProvider from '@/components/Swap/SwapModalProvider';
import { toastProps } from '@/components/Toast';
import { TurnkeyProvider } from '@/components/TurnkeyProvider';
import { Button } from '@/components/ui/button';
import UnstakeModalProvider from '@/components/Unstake/UnstakeModalProvider';
import WhatsNewModal from '@/components/WhatsNewModal';
import WithdrawModalProvider from '@/components/Withdraw/WithdrawModalProvider';
import '@/global.css';
import { infoClient } from '@/graphql/clients';
import { useAttributionInitialization } from '@/hooks/useAttributionInitialization';
import { useWhatsNew } from '@/hooks/useWhatsNew';
import { initAnalytics, trackScreen } from '@/lib/analytics';
import { config } from '@/lib/wagmi';
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
import * as Notifications from 'expo-notifications';
import type { ErrorBoundaryProps } from 'expo-router';
import { router, Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { WagmiProvider } from 'wagmi';

// Lazy-loaded to defer thirdweb bundle until actually needed
import { LazyThirdwebProvider } from '@/components/LazyThirdwebProvider';

Sentry.init({
  dsn: 'https://8e2914f77c8a188a9938a9eaa0ffc0ba@o4509954049376256.ingest.us.sentry.io/4509954077949952',

  // Only enable Sentry in production
  enabled: process.env.EXPO_PUBLIC_ENVIRONMENT === 'production' && !__DEV__,

  // Set environment from env variable
  environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',

  // Debug logs only in non-production environments
  debug: process.env.EXPO_PUBLIC_ENVIRONMENT !== 'production',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Performance Monitoring
  tracesSampleRate: 0.2, // Capture 20% of transactions for performance monitoring
  profilesSampleRate: 0.2, // Profile 20% of sampled transactions

  // Release Health
  enableAutoSessionTracking: true, // Track user sessions
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
  maxBreadcrumbs: 100, // Better debugging context
  beforeBreadcrumb(breadcrumb) {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null; // Don't record debug console logs
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
  attachScreenshot: true, // Attach screenshots to errors
  attachViewHierarchy: true, // Attach view hierarchy for debugging

  // Network tracking
  tracePropagationTargets: [
    // Only trace requests to your own backend
    /^https:\/\/.*\.solid\.xyz/,
  ],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
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
  const { whatsNew, isVisible, closeWhatsNew } = useWhatsNew();

  // Initialize attribution tracking automatically (handles web and mobile)
  useAttributionInitialization();

  const [loaded, error] = useFonts({
    MonaSans_200ExtraLight,
    MonaSans_300Light,
    MonaSans_400Regular,
    MonaSans_500Medium,
    MonaSans_600SemiBold,
    MonaSans_700Bold,
    MonaSans_800ExtraBold,
    MonaSans_900Black,
  });
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  useEffect(() => {
    // Only run on Web and only in production
    if (Platform.OS === 'web' && process.env.EXPO_PUBLIC_ENVIRONMENT === 'production') {
      injectSpeedInsights();
    }
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make any API calls you need to do here
        // await Font.loadAsync(Entypo.font);

        await initAnalytics();
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
    if (error) {
      console.error('Error loading fonts:', error);
    }
  }, [error]);

  if (!appIsReady || !loaded) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <TurnkeyProvider>
        <LazyThirdwebProvider>
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <ApolloProvider client={infoClient}>
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
                      <DepositModalProvider />
                      <SendModalProvider />
                      <SwapModalProvider />
                      <WithdrawModalProvider />
                      <StakeModalProvider />
                      <UnstakeModalProvider />
                      <DepositFromSafeAccountModalProvider />
                      <CardDepositModalProvider />
                      {whatsNew && (
                        <WhatsNewModal
                          whatsNew={whatsNew}
                          isOpen={isVisible}
                          onClose={closeWhatsNew}
                        />
                      )}
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
});
