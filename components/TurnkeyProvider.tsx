"use client";

import {
  EXPO_PUBLIC_AASA_URL,
  EXPO_PUBLIC_RELYING_PARTY_ID,
  EXPO_PUBLIC_TURNKEY_API_BASE_URL,
  EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID,
  isAASADevelopment,
} from "@/lib/config";
import {TurnkeyProvider as TurnkeyProviderNative} from "@turnkey/sdk-react-native";
import {Platform} from "react-native";

// Helper to get current hostname in runtime; falls back to configured value during SSR.
export const getRuntimeRpId = () => {
  // Use environment variable if set, otherwise fallback to defaults
  if (EXPO_PUBLIC_RELYING_PARTY_ID) {
    console.log("🔐 Using RP ID from env:", EXPO_PUBLIC_RELYING_PARTY_ID);
    if (isAASADevelopment) {
      console.log("🌐 AASA Development Mode - URL:", EXPO_PUBLIC_AASA_URL);
    }
    return EXPO_PUBLIC_RELYING_PARTY_ID;
  }

  const rpId = Platform.OS === "web" && __DEV__ ? "localhost" : "solid.xyz";
  console.log(
    "🔐 Using default RP ID:",
    rpId,
    "Platform:",
    Platform.OS,
    "DEV:",
    __DEV__,
  );
  return rpId;
};

export const TurnkeyProvider: React.FC<{children: React.ReactNode}> = ({
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
