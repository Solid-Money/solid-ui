"use client";

import {
  EXPO_PUBLIC_TURNKEY_API_BASE_URL,
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
} from "@/lib/config";
import { TurnkeyProvider as TurnkeyProviderNative } from "@turnkey/sdk-react-native";
import { Platform } from "react-native";

// Helper to get current hostname in runtime; falls back to configured value during SSR.
export const getRuntimeRpId = () => (Platform.OS === 'web' && __DEV__) ? "localhost" : 'solid.xyz'

export const TurnkeyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) =>
  Platform.OS === "web" ? (
     children 
  ) : (
    <TurnkeyProviderNative
      config={{
        organizationId: EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
        apiBaseUrl: EXPO_PUBLIC_TURNKEY_API_BASE_URL,
      }}
    >
      {children}
    </TurnkeyProviderNative>
  );
