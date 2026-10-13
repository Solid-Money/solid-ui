import { useEffect, useMemo } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Href, Redirect, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, ExternalLink } from 'lucide-react-native';

import {
  CopyLinkButton,
  GetAppButton,
  openInBrowserInstruction,
  preferredBrowserName,
} from '@/components/Onboarding/OpenInBrowser';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { detectPasskeyBlock } from '@/hooks/usePasskey';
import { track } from '@/lib/analytics';
import { buildOpenInBrowserUrl, PasskeyBlock } from '@/lib/utils/passkeySupport';

const describeBlock = (block: PasskeyBlock): { title: string; body: string } => {
  const browser = preferredBrowserName(block.platform);
  if (block.reason === 'in_frame') {
    return {
      title: 'Open Solid in its own tab',
      body: 'Solid is open inside another page, which is not allowed to create the passkey that protects your account.',
    };
  }
  if (block.inAppBrowser) {
    const where = block.app ? `${block.app}'s built-in browser` : "This app's built-in browser";
    return {
      title: `Open Solid in ${browser}`,
      body: `${where} can't create passkeys, and Solid uses a passkey to protect your account.`,
    };
  }
  return {
    title: "This browser can't create passkeys",
    body: 'Solid uses a passkey to protect your account. Update this browser, or open Solid in Chrome, Safari, Edge or Firefox.',
  };
};

/**
 * Where browsers that cannot create a passkey are sent, from every route that
 * needs one (see `PasskeySupportGate`).
 *
 * It used to show a debugging line ("Error: In iOS webview") and no way out,
 * and it did not even stay up: a second later the app's session-expired
 * handler moved signed-out visitors on to onboarding, where they signed up and
 * failed at the passkey step instead.
 */
export default function PasskeyNotSupported() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const block = useMemo(() => detectPasskeyBlock(), []);
  // React Native has a `window` but no `location`; this screen is web-only anyway.
  const origin =
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '';
  const fromPath = typeof from === 'string' ? from : undefined;
  const link = buildOpenInBrowserUrl(origin, fromPath);

  useEffect(() => {
    if (!block) return;
    track(TRACKING_EVENTS.PASSKEY_NOT_SUPPORTED_VIEWED, {
      reason: block.reason,
      device_platform: block.platform,
      in_app_browser: block.app ?? (block.inAppBrowser ? 'unknown' : undefined),
      // The path alone: the query can carry personal details.
      from_path: fromPath?.split('?')[0],
    });
  }, [block, fromPath]);

  // Nothing stops this browser (a bookmark, or the link opened somewhere
  // that can create passkeys): carry on to where the person was going.
  if (!block) {
    return <Redirect href={(link.slice(origin.length) || path.HOME) as Href} />;
  }

  const { title, body } = describeBlock(block);
  const Icon = block.inAppBrowser || block.reason === 'in_frame' ? ExternalLink : AlertTriangle;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="flex-grow items-center justify-center px-6 py-10">
        <View className="w-full max-w-[420px] items-center gap-6">
          <Icon size={48} color="rgba(255, 255, 255, 0.8)" />

          <View className="items-center gap-3">
            <Text className="text-center text-[30px] font-semibold leading-[34px] -tracking-[1px] text-white">
              {title}
            </Text>
            <Text className="text-center text-base leading-6 text-white/60">{body}</Text>
          </View>

          {block.inAppBrowser ? (
            <View className="w-full gap-2 rounded-2xl bg-[#1C1C1C] p-4">
              <Text className="text-sm leading-5 text-white/70">
                {openInBrowserInstruction(block.platform)}
              </Text>
              <Text className="text-sm leading-5 text-white/70">
                {`Or copy the link below and paste it into ${preferredBrowserName(block.platform)}.`}
              </Text>
            </View>
          ) : null}

          <Text selectable className="text-center text-sm text-white/50">
            {link}
          </Text>

          <View className="w-full gap-3">
            {block.reason === 'in_frame' ? (
              <Button
                variant="brand"
                className="h-14 w-full rounded-xl"
                onPress={() => Linking.openURL(link)}
              >
                <Text className="text-base font-semibold text-black">Open Solid</Text>
              </Button>
            ) : (
              <CopyLinkButton url={link} context="not_supported" />
            )}
            <GetAppButton platform={block.platform} context="not_supported" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
