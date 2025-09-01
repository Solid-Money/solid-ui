import { toastProps } from '@/components/Toast';
import { TurnkeyProvider } from '@/components/TurnkeyProvider';
import { Button } from '@/components/ui/button';
import '@/global.css';
import { infoClient } from '@/graphql/clients';
import { config } from '@/lib/wagmi';
import { ApolloProvider } from '@apollo/client';
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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { ThirdwebProvider } from 'thirdweb/react';
import { WagmiProvider } from 'wagmi';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

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

// Set the animation options for a smoother transition
SplashScreen.setOptions({
  duration: 1500,
  fade: true,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [splashScreenHidden, setSplashScreenHidden] = useState(false);
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

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make any API calls you need to do here
        // await Font.loadAsync(Entypo.font);

        // Simulate loading time - replace with actual async operations
        Appearance.setColorScheme('dark');
        await new Promise(resolve => setTimeout(resolve, 2000));

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

  useEffect(() => {
    if (error) {
      console.error('Error loading fonts:', error);
    }
  }, [error]);

  if (!appIsReady || !loaded) {
    return null;
  }

  const AppContent = () => (
    <Stack>
      <Stack.Screen
        name="(protected)"
        options={{
          headerShown: false,
          animation: 'none',
        }}
      />
      <Stack.Screen
        name="register"
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
            <Button variant="ghost" size="icon" onPress={() => router.back()} className="mr-4">
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
    </Stack>
  );

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <TurnkeyProvider>
        <ThirdwebProvider>
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <ApolloProvider client={infoClient}>
                <GestureHandlerRootView>
                  <BottomSheetModalProvider>
                    {Platform.OS === 'web' && (
                      <Head>
                        <title>Solid - The Savings Super-App</title>
                      </Head>
                    )}
                    <AppContent />
                    <PortalHost />
                  </BottomSheetModalProvider>
                </GestureHandlerRootView>
              </ApolloProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </ThirdwebProvider>
        <Toast {...toastProps} />
      </TurnkeyProvider>
    </SafeAreaProvider>
  );
}
