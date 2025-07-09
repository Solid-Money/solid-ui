import "@/global.css";
import { ApolloProvider } from "@apollo/client";
import { AppKit } from "@reown/appkit-wagmi-react-native";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { WagmiProvider } from "wagmi";

import { infoClient } from "@/graphql/clients";
import { toastProps } from "@/components/Toast";
import { wagmi } from "@/lib/wagmi";

// see: https://solana.stackexchange.com/a/6244
global.Buffer = require("buffer").Buffer;
export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from "expo-router";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <WagmiProvider config={wagmi.config}>
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
            {Platform.OS !== 'web' && <AppKit />}
          </ApolloProvider>
        </QueryClientProvider>
      </WagmiProvider>
      <PortalHost />
      <Toast {...toastProps} />
    </SafeAreaProvider>
  );
}
