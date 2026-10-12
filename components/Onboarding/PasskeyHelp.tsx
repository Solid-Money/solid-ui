import { Platform, View } from 'react-native';

import {
  CopyLinkButton,
  openInBrowserInstruction,
  preferredBrowserName,
} from '@/components/Onboarding/OpenInBrowser';
import { Text } from '@/components/ui/text';
import { PasskeyFailureKind } from '@/lib/utils/passkeyErrors';
import { DevicePlatform } from '@/lib/utils/passkeySupport';

/** What to tell someone whose passkey was not created, by what went wrong. */
export const passkeyFailureMessage = (kind: PasskeyFailureKind, isWeb: boolean): string => {
  switch (kind) {
    case 'cancelled':
      return 'Passkey setup was cancelled. Tap Continue to try again.';
    case 'not_allowed':
      return "Passkey setup didn't finish. Tap Continue to try again.";
    case 'blocked':
      return isWeb
        ? "This browser didn't allow passkey setup."
        : "Your device didn't allow passkey setup.";
    case 'unsupported':
      return isWeb ? "This browser can't create passkeys." : "This device can't create passkeys.";
    case 'device_setup':
      return "Your device couldn't save the passkey.";
    default:
      return "We couldn't create your passkey. Please try again.";
  }
};

/**
 * Whether to show the setup tips. At once when the failure is about the
 * device or browser, which another tap cannot fix; otherwise from the second
 * failure, so a single dismissed prompt is not met with a checklist.
 */
export const shouldShowPasskeyHelp = (kind: PasskeyFailureKind, failureCount: number): boolean =>
  kind === 'blocked' || kind === 'unsupported' || kind === 'device_setup' || failureCount >= 2;

/** What a device needs before it can hold a passkey. */
export const passkeySetupTips = (platform: DevicePlatform, isWeb: boolean): string[] => {
  if (platform === 'android') {
    return [
      'Set a screen lock (PIN, pattern or fingerprint) in Settings → Security.',
      'Turn on Google Password Manager and sign in to your Google account, in Settings under Passwords & accounts.',
      isWeb
        ? 'Update Chrome and Google Play services, then try again.'
        : 'Update Google Play services from the Play Store, then try again.',
    ];
  }
  if (platform === 'ios') {
    return [
      'Set a passcode and Face ID or Touch ID in Settings → Face ID & Passcode.',
      'Turn on iCloud Keychain: Settings → your name → iCloud → Passwords and Keychain.',
      ...(isWeb ? ['Use Safari, or Chrome or Firefox for iPhone.'] : []),
    ];
  }
  return [
    'Use an up-to-date Chrome, Safari, Edge or Firefox.',
    'Or sign up on your phone instead.',
  ];
};

type PasskeyHelpProps = {
  kind: PasskeyFailureKind;
  platform: DevicePlatform;
  /** Web: this page looks like it is open in another app's browser. */
  inAppBrowser?: boolean;
  /** Web: the link to reopen this page in a real browser. */
  openInBrowserUrl?: string;
};

/**
 * Setup tips under the passkey step, once creating one has failed.
 *
 * A failure used to show nothing at all on native, and on web a toast that
 * said only that it failed (or, for an in-app browser that refused outright,
 * "Request cancelled."). Android, where it fails most often, never said what to
 * change on the phone.
 */
export function PasskeyHelp({ kind, platform, inAppBrowser, openInBrowserUrl }: PasskeyHelpProps) {
  const isWeb = Platform.OS === 'web';
  // An instant refusal, or no support at all, is what an in-app browser
  // produces, including the ones whose user agent copies Safari's.
  const suggestBrowser = isWeb && (inAppBrowser || kind === 'blocked' || kind === 'unsupported');
  const browser = preferredBrowserName(platform);

  return (
    <View className="w-full gap-3 rounded-2xl bg-[#1C1C1C] p-4">
      <Text className="text-base font-semibold text-white">Can&apos;t create a passkey?</Text>

      {suggestBrowser && openInBrowserUrl ? (
        <View className="gap-3">
          <Text className="text-sm leading-5 text-white/70">
            {`Opened this link from another app? Its built-in browser can't create passkeys, so open the link in ${browser}. ${openInBrowserInstruction(platform)}`}
          </Text>
          <CopyLinkButton url={openInBrowserUrl} context="passkey_help" variant="secondary" />
        </View>
      ) : null}

      {passkeySetupTips(platform, isWeb).map(tip => (
        <View key={tip} className="flex-row gap-2">
          <Text className="text-sm leading-5 text-white/70">•</Text>
          <Text className="flex-1 text-sm leading-5 text-white/70">{tip}</Text>
        </View>
      ))}
    </View>
  );
}
