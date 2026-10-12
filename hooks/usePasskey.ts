import { Platform } from 'react-native';
import { Href } from 'expo-router';

import { path } from '@/constants/path';
import { getPasskeyBlock, PasskeyBlock, readBrowserEnvironment } from '@/lib/utils/passkeySupport';

/**
 * Why this browser cannot create a passkey, or `null` when it can try.
 *
 * Always `null` on native, where passkeys go through the OS rather than a
 * browser. See `lib/utils/passkeySupport.ts` for what counts as a block, and
 * why nothing that could create a passkey is blocked.
 */
export function detectPasskeyBlock(): PasskeyBlock | null {
  if (Platform.OS !== 'web') return null;
  const environment = readBrowserEnvironment();
  return environment ? getPasskeyBlock(environment) : null;
}

/**
 * The "open Solid in your browser" screen, told which page the person was on.
 *
 * The path matters because its query carries the referral code and campaign
 * tags: the link that screen copies should land them where they were, with
 * the same attribution, once it is open in a real browser.
 */
export function passkeyNotSupportedHref(): Href {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return path.PASSKEY_NOT_SUPPORTED;
  const from = `${window.location.pathname}${window.location.search}`;
  if (from.startsWith(path.PASSKEY_NOT_SUPPORTED as string)) return path.PASSKEY_NOT_SUPPORTED;
  return { pathname: path.PASSKEY_NOT_SUPPORTED as '/passkey-not-supported', params: { from } };
}
