import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/constants/appStores';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { DevicePlatform } from '@/lib/utils/passkeySupport';

/** Where `context` is reported: the full-screen block, or the help under the passkey step. */
export type OpenInBrowserContext = 'not_supported' | 'passkey_help';

/** The browser to send someone to on their device. */
export const preferredBrowserName = (platform: DevicePlatform): string =>
  platform === 'ios' ? 'Safari' : platform === 'android' ? 'Chrome' : 'your browser';

/** Where in-app browsers keep their "open in browser" option. */
export const openInBrowserInstruction = (platform: DevicePlatform): string => {
  if (platform === 'ios') {
    return 'Tap ••• or the share button, then choose “Open in Safari” or “Open in browser”.';
  }
  if (platform === 'android') {
    return 'Tap ⋮ in a top corner, then choose “Open in Chrome” or “Open in browser”.';
  }
  return 'Copy the link and open it in Chrome, Safari, Edge or Firefox.';
};

type CopyLinkButtonProps = {
  url: string;
  context: OpenInBrowserContext;
  variant?: 'brand' | 'secondary';
};

/**
 * Copies the link to reopen Solid in a real browser.
 *
 * Copying is the one way out that works in every in-app browser: the "open in
 * browser" menu item is named and placed differently in each app, and some
 * have none. expo-clipboard falls back to the legacy copy command where the
 * Clipboard API is missing, which it is in some of them.
 */
export function CopyLinkButton({ url, context, variant = 'brand' }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const didCopy = await Clipboard.setStringAsync(url).catch(() => false);
    setCopied(didCopy);
    track(TRACKING_EVENTS.OPEN_IN_BROWSER_LINK_COPIED, { context, copied: didCopy });
  }, [url, context]);

  return (
    <Button variant={variant} className="h-14 w-full rounded-xl" onPress={handleCopy}>
      <Text
        className={`text-base font-semibold ${variant === 'brand' ? 'text-black' : 'text-white'}`}
      >
        {copied ? 'Link copied. Paste it in your browser' : 'Copy link'}
      </Text>
    </Button>
  );
}

type GetAppButtonProps = {
  platform: DevicePlatform;
  context: OpenInBrowserContext;
};

/** The native app creates passkeys through the OS, whatever app the link was opened in. */
export function GetAppButton({ platform, context }: GetAppButtonProps) {
  const storeUrl =
    platform === 'ios' ? APP_STORE_URL : platform === 'android' ? PLAY_STORE_URL : null;

  const handlePress = useCallback(() => {
    if (!storeUrl) return;
    track(TRACKING_EVENTS.GET_APP_PRESSED, { context, store: platform });
    Linking.openURL(storeUrl).catch(() => {});
  }, [storeUrl, context, platform]);

  if (!storeUrl) return null;

  return (
    <Button variant="secondary" className="h-14 w-full rounded-xl" onPress={handlePress}>
      <Text className="text-base font-semibold text-white">Get the Solid app instead</Text>
    </Button>
  );
}
