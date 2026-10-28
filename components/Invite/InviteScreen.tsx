import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Redirect, router } from 'expo-router';

import { ReferIcon } from '@/components/Referral/v4/ReferV4Primitives';
import { Text } from '@/components/ui/text';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/constants/appStores';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { useReferralInvite } from '@/hooks/useReferralInvite';
import { track } from '@/lib/analytics';
import {
  buildPlayStoreInviteUrl,
  inviteClipboardText,
  normalizeReferralCode,
} from '@/lib/referral/inviteCode';
import { formatUsdWhole } from '@/lib/referral/referralV4';
import { cn } from '@/lib/utils';
import { type DevicePlatform, getDevicePlatform } from '@/lib/utils/passkeySupport';
import { useReferralStore } from '@/store/useReferralStore';
import { useUserStore } from '@/store/useUserStore';

import type { ReferralInviteLookup } from '@/lib/types';

const QR_SIZE = 180;
const QR_QUIET_ZONE = 12;

interface InviteCopy {
  /** "Dana invited you"; null when we don't know who. */
  invitedBy: string | null;
  title: string;
  subtitle: string;
  steps: string[];
  footnote: string | null;
}

/** What the page says, from the lookup: v4's card credit, today's offer, or a plain welcome. */
const inviteCopy = (lookup: ReferralInviteLookup | undefined): InviteCopy => {
  if (lookup?.valid && lookup.offer) {
    const { friendCreditUsd, spendTargetUsd, merchantTarget, windowDays } = lookup.offer;
    return {
      invitedBy: `${lookup.referrer.username} invited you`,
      title: `Get ${formatUsdWhole(friendCreditUsd)} to spend\nwith your card`,
      subtitle: `Spend ${formatUsdWhole(spendTargetUsd)} in your first ${windowDays} days and your next ${formatUsdWhole(
        friendCreditUsd,
      )} of purchases are on us.`,
      steps: [
        'Create your account',
        'Get your free card',
        `Spend ${formatUsdWhole(spendTargetUsd)} at ${merchantTarget} or more shops`,
      ],
      footnote: 'Card credit can only be spent with your Solid card.',
    };
  }

  if (lookup?.valid && lookup.legacyOffer) {
    const { friendRewardUsd, spendTargetUsd, merchantTarget, windowDays, payoutToken } =
      lookup.legacyOffer;
    return {
      invitedBy: `${lookup.referrer.username} invited you`,
      title: `Get ${formatUsdWhole(friendRewardUsd)} when you\nspend with your card`,
      subtitle: `Spend ${formatUsdWhole(spendTargetUsd)} in your first ${windowDays} days and get ${formatUsdWhole(
        friendRewardUsd,
      )} in ${payoutToken}.`,
      steps: [
        'Create your account',
        'Get your free card',
        `Spend ${formatUsdWhole(spendTargetUsd)} at ${merchantTarget} or more shops`,
      ],
      footnote: null,
    };
  }

  return {
    invitedBy: lookup?.valid ? `${lookup.referrer.username} invited you` : null,
    title: 'Welcome to Solid',
    subtitle: 'Save, spend and earn with one account and your Solid card.',
    steps: ['Create your account', 'Get your free card', 'Spend and earn cashback'],
    footnote: null,
  };
};

const Steps = ({ steps }: { steps: string[] }) => (
  <View className="w-full overflow-hidden rounded-[20px] bg-card px-4 py-1">
    {steps.map((step, index) => (
      <View
        key={step}
        className={cn(
          'flex-row items-center gap-3 py-[14px]',
          index > 0 && 'border-t border-white/[0.06]',
        )}
      >
        <View className="h-7 w-7 items-center justify-center rounded-full bg-[#303030]">
          <Text className="text-[13px] font-semibold text-white/85">{index + 1}</Text>
        </View>
        <Text className="flex-1 text-[15px] font-medium text-white">{step}</Text>
      </View>
    ))}
  </View>
);

const PrimaryButton = ({
  label,
  onPress,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityHint={accessibilityHint}
    className="h-[56px] w-full items-center justify-center rounded-[16px] bg-brand active:opacity-80 web:hover:opacity-90"
  >
    <Text className="text-[16px] font-semibold text-black">{label}</Text>
  </Pressable>
);

const SecondaryButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    className="h-[56px] w-full items-center justify-center rounded-[16px] bg-card active:opacity-80 web:hover:bg-card-hover"
  >
    <Text className="text-[16px] font-semibold text-white">{label}</Text>
  </Pressable>
);

/** The phone a mobile-web visitor is on, so the right store button leads. */
const webDevicePlatform = (): DevicePlatform => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return 'other';
  return getDevicePlatform(navigator.userAgent, (navigator.maxTouchPoints ?? 0) > 0);
};

/** Same tab: a store link is a hand-off to the store app, not a page to come back to. */
const openStore = (url: string) => {
  if (typeof window !== 'undefined') window.location.assign(url);
};

/**
 * The public invite page an invite link opens (Figma 29602:13466): who invited
 * the friend, what they get, and the three steps to get it.
 *
 * In the app it stores the code for signup and sends the friend there. On the
 * web it is also the hand-off to the app: a QR code on desktop, the store
 * buttons on a phone — Play carrying the code as the install referrer, the App
 * Store side copying it to the clipboard for the signup screen to offer back.
 * Anyone already signed in just goes home; the invite is for new accounts and
 * must not replace the referrer an existing one already has.
 */
export default function InviteScreen({ rawCode }: { rawCode: string | undefined }) {
  const { isDesktop } = useDimension();
  const usersHydrated = useUserStore(state => state._hasHydrated);
  const isSignedIn = useUserStore(state => state.users.some(user => user.selected));
  const referralHydrated = useReferralStore(state => state._hasHydrated);
  const code = normalizeReferralCode(rawCode);
  const { data: lookup, isLoading, isError } = useReferralInvite(code);
  const handled = useRef(false);

  const isReady = usersHydrated && referralHydrated && (!code || !isLoading);

  // Keep the code for signup — once, and only for someone who could use it.
  useEffect(() => {
    if (!isReady || isSignedIn || handled.current) return;
    handled.current = true;

    const program = lookup?.valid ? lookup.program : null;
    track(TRACKING_EVENTS.INVITE_SCREEN_VIEWED, { program, source: 'link' });

    if (lookup?.valid) {
      useReferralStore.getState().setReferralCode(lookup.code, 'link');
      track(TRACKING_EVENTS.INVITE_CODE_APPLIED, { source: 'link' });
    } else if (code && isError) {
      // The lookup is unavailable (not deployed yet, offline): keep the code,
      // signup sends it and the backend decides.
      useReferralStore.getState().setReferralCode(code, 'link');
      track(TRACKING_EVENTS.INVITE_CODE_APPLIED, { source: 'link', verified: false });
    } else {
      track(TRACKING_EVENTS.INVITE_CODE_INVALID, { source: 'link' });
    }
  }, [isReady, isSignedIn, lookup, code, isError]);

  const copy = useMemo(() => inviteCopy(lookup), [lookup]);
  const storedCode = lookup?.valid ? lookup.code : code;
  const platform = useMemo(() => webDevicePlatform(), []);
  const isWeb = Platform.OS === 'web';
  const pageUrl = isWeb && typeof window !== 'undefined' ? window.location.href : '';

  const getStarted = useCallback(() => router.push(path.SIGNUP_EMAIL), []);
  const close = useCallback(() => router.replace(path.ONBOARDING), []);

  const openAppStore = useCallback(async () => {
    track(TRACKING_EVENTS.GET_APP_PRESSED, { context: 'invite', store: 'ios' });
    // iOS has no install referrer: the code rides the clipboard instead, and the
    // signup screen offers to paste it back without a prompt.
    if (storedCode) {
      await Clipboard.setStringAsync(inviteClipboardText(storedCode)).catch(() => false);
    }
    openStore(APP_STORE_URL);
  }, [storedCode]);

  const openPlayStore = useCallback(() => {
    track(TRACKING_EVENTS.GET_APP_PRESSED, { context: 'invite', store: 'android' });
    // The code rides along as the install referrer; the app reads it on first launch.
    openStore(storedCode ? buildPlayStoreInviteUrl(storedCode) : PLAY_STORE_URL);
  }, [storedCode]);

  if (usersHydrated && isSignedIn) return <Redirect href={path.HOME} />;

  if (!isReady) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="white" />
      </SafeAreaView>
    );
  }

  const hero = (
    <View className="items-center px-7 pt-4">
      <ReferIcon asset="images/referral-v4/gift-72.svg" size={72} />
      {copy.invitedBy ? (
        <View className="mt-4 rounded-full bg-card px-3 py-1.5">
          <Text className="text-[13px] font-medium text-white/70">{copy.invitedBy}</Text>
        </View>
      ) : null}
      <Text className="mt-4 text-center text-[30px] font-semibold leading-[34px] text-white">
        {copy.title}
      </Text>
      <Text className="mt-2.5 text-center text-[15px] leading-[21px] text-white/60">
        {copy.subtitle}
      </Text>
    </View>
  );

  const footnote = copy.footnote ? (
    <Text className="text-center text-[12px] text-white/40">{copy.footnote}</Text>
  ) : null;

  // Desktop web: the app is on the phone in their pocket — hand over with a QR.
  if (isWeb && isDesktop) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingVertical: 48 }}>
          <View className="w-full max-w-[440px] gap-7 px-4">
            {hero}
            <Steps steps={copy.steps} />
            {pageUrl ? (
              <View className="items-center gap-3 rounded-[20px] bg-card p-6">
                <View
                  className="overflow-hidden rounded-[16px]"
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel="QR code to open this invite on your phone"
                >
                  <QRCode
                    value={pageUrl}
                    size={QR_SIZE}
                    color="white"
                    backgroundColor="#1C1C1C"
                    quietZone={QR_QUIET_ZONE}
                  />
                </View>
                <Text className="text-[16px] font-semibold text-white">Scan to get the app</Text>
                <Text className="text-center text-[13px] text-white/50">
                  Open your phone’s camera and point it at the code.
                </Text>
              </View>
            ) : null}
            <View className="gap-3">
              <PrimaryButton label="Continue on web" onPress={getStarted} />
              {footnote}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Phone web: the stores first, the one for this phone leading.
  const storeButtons = isWeb ? (
    <View className="w-full gap-3">
      {platform !== 'android' ? (
        <PrimaryButton label="Get the app on the App Store" onPress={openAppStore} />
      ) : null}
      {platform !== 'ios' ? (
        platform === 'android' ? (
          <PrimaryButton label="Get the app on Google Play" onPress={openPlayStore} />
        ) : (
          <SecondaryButton label="Get the app on Google Play" onPress={openPlayStore} />
        )
      ) : null}
      <Pressable
        onPress={getStarted}
        accessibilityRole="button"
        hitSlop={8}
        className="items-center py-2 active:opacity-70 web:hover:opacity-80"
      >
        <Text className="text-[15px] font-medium text-white/70">Continue on web</Text>
      </Pressable>
    </View>
  ) : (
    <PrimaryButton label="Get started" onPress={getStarted} />
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="mx-auto w-full max-w-lg flex-1">
        <View className="flex-row justify-end px-4 py-2">
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            className="active:opacity-70 web:hover:opacity-80"
          >
            <ReferIcon asset="images/referral-v4/close.svg" size={36} />
          </Pressable>
        </View>
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
          {hero}
          <View className="px-4 pt-7">
            <Steps steps={copy.steps} />
          </View>
        </ScrollView>
        <View className="items-center gap-3 px-4 pb-3 pt-2">
          {storeButtons}
          {footnote}
        </View>
      </View>
    </SafeAreaView>
  );
}
