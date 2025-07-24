import { toastProps } from "@/components/Toast";
import { TurnkeyProvider } from "@/components/TurnkeyProvider";
import "@/global.css";
import { infoClient } from "@/graphql/clients";
import { config } from "@/lib/wagmi";
import { ApolloProvider } from "@apollo/client";
import { PortalHost } from "@rn-primitives/portal";
import { ThirdwebProvider } from "thirdweb/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { WagmiProvider } from "wagmi";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Set the animation options for a smoother transition
SplashScreen.setOptions({
  duration: 1500,
  fade: true,
});

const queryClient = new QueryClient();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [splashScreenHidden, setSplashScreenHidden] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make any API calls you need to do here
        // await Font.loadAsync(Entypo.font);

        // Simulate loading time - replace with actual async operations
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Add any additional initialization here
        // await initializeApp();
      } catch (e) {
        console.warn("Error during app initialization:", e);
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
        console.warn("Error hiding splash screen:", error);
      }
    }
  }, [appIsReady, splashScreenHidden]);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <TurnkeyProvider>
        <ThirdwebProvider>
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <ApolloProvider client={infoClient}>
                <Head>
                  <title>Solid</title>
                </Head>
                <Stack>
                  <Stack.Screen
                    name="(protected)"
                    options={{
                      headerShown: false,
                      animation: "none",
                    }}
                  />
                  <Stack.Screen
                    name="register"
                    options={{
                      headerShown: false,
                      animation: "none",
                    }}
                  />
                  <Stack.Screen
                    name="welcome"
                    options={{
                      headerShown: false,
                      animation: "none",
                    }}
                  />
                </Stack>
              </ApolloProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </ThirdwebProvider>
        <PortalHost />
        <Toast {...toastProps} />
      </TurnkeyProvider>
    </SafeAreaProvider>
  );
}
