import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getWebProvisioningToken } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';

const SCRIPT_URL = process.env.EXPO_PUBLIC_APPLE_WEB_PROVISIONING_SCRIPT_URL ?? '';
const PARTNER_ID = process.env.EXPO_PUBLIC_APPLE_WEB_PROVISIONING_PARTNER_ID ?? '';
const DOMAIN = process.env.EXPO_PUBLIC_APPLE_WEB_PROVISIONING_DOMAIN ?? 'solid.xyz';
const BUTTON_ID = 'add-to-apple-wallet-web';

declare global {
  interface Window {
    initAddToAppleWallet?: (config: {
      partnerId: string;
      domain: string;
      buttonId: string;
      jwtResolver: () => Promise<unknown>;
      resultResolver: (result: unknown) => void;
    }) => void;
  }
}

/**
 * Web-only: "Add to Apple Wallet" via Apple Web Provisioning.
 * Renders nothing on native. Requires EXPO_PUBLIC_APPLE_WEB_PROVISIONING_SCRIPT_URL
 * (and optionally PARTNER_ID, DOMAIN) to be set.
 */
export default function AddToAppleWalletWeb() {
  const [scriptReady, setScriptReady] = useState(false);
  const mounted = useRef(true);

  const jwtResolver = useCallback(async () => {
    const token = await withRefreshToken(() => getWebProvisioningToken());
    return token;
  }, []);

  const resultResolver = useCallback((result: unknown) => {
    if (!mounted.current) return;
    const r = result as { success?: boolean; error?: string };
    if (r?.success) {
      Toast.show({
        type: 'success',
        text1: 'Added to Apple Wallet',
        text2: 'Your card is now in Apple Wallet.',
      });
    } else if (r?.error) {
      Toast.show({ type: 'error', text1: 'Could not add to Apple Wallet', text2: String(r.error) });
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !SCRIPT_URL || typeof document === 'undefined') return;

    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => setScriptReady(true);
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !scriptReady || !window.initAddToAppleWallet || !PARTNER_ID)
      return;

    window.initAddToAppleWallet({
      partnerId: PARTNER_ID,
      domain: DOMAIN,
      buttonId: BUTTON_ID,
      jwtResolver,
      resultResolver,
    });
  }, [scriptReady, jwtResolver, resultResolver]);

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const el = document.getElementById(BUTTON_ID);
    el?.click();
  }, []);

  if (Platform.OS !== 'web') return null;
  if (!SCRIPT_URL || !PARTNER_ID) {
    return (
      <View className="rounded-xl border border-[#303030] bg-[#1a1a1a] p-4">
        <Text className="text-sm text-muted-foreground">
          Add to Apple Wallet (web) is not configured. Set
          EXPO_PUBLIC_APPLE_WEB_PROVISIONING_SCRIPT_URL and PARTNER_ID.
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-xl border border-[#303030] bg-[#1a1a1a] p-4">
      <Text className="mb-3 text-base font-medium text-white">Add to Apple Wallet</Text>
      <Text className="mb-4 text-sm text-muted-foreground">
        Add your card to Apple Wallet from this page to use it with Apple Pay.
      </Text>
      {scriptReady ? (
        <View>
          <input
            type="image"
            id={BUTTON_ID}
            alt="Add to Apple Wallet"
            aria-hidden
            style={{ position: 'absolute', left: -9999, width: 1, height: 1 }}
          />
          <Button
            onPress={handlePress}
            className="rounded-xl bg-black py-4"
            style={{ borderWidth: 1, borderColor: '#888' }}
          >
            <Text className="text-base font-semibold text-white">Add to Apple Wallet</Text>
          </Button>
        </View>
      ) : (
        <Button disabled className="rounded-xl bg-[#303030] py-4">
          <Text className="text-muted-foreground">Loading...</Text>
        </Button>
      )}
    </View>
  );
}
