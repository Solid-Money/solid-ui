import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import {
  type InviteCopy,
  inviteCopy,
  inviteHeaderLabel,
  inviterInitial,
  type InviteTitlePart,
} from '@/components/Invite/inviteCopy';
import {
  CARD_ASPECT,
  DESKTOP_LAYOUT,
  FADE_COLORS,
  FADE_LOCATIONS,
  inviteCardWidth,
  type InviteLayout,
  inviteTitleScale,
  LOGO_LOCKUP,
  MOBILE_LAYOUT,
} from '@/components/Invite/inviteLayout';
import { Text } from '@/components/ui/text';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/constants/appStores';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { useReferralInvite } from '@/hooks/useReferralInvite';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import {
  buildPlayStoreInviteUrl,
  inviteClipboardText,
  normalizeReferralCode,
} from '@/lib/referral/inviteCode';
import { cn } from '@/lib/utils';
import { type DevicePlatform, getDevicePlatform } from '@/lib/utils/passkeySupport';
import { useReferralStore } from '@/store/useReferralStore';
import { useUserStore } from '@/store/useUserStore';

/** "Learn about Solid" — the marketing site. */
const SOLID_SITE_URL = 'https://solid.xyz';

/** The QR on desktop (Figma 31314:3916): 120pt, with a 7.5pt quiet zone around the code. */
const QR_SIZE = 120;
const QR_QUIET_ZONE = 8.571;

/** Web-only CSS for the pill's frosted glass, which React Native's ViewStyle doesn't declare. */
const PILL_GLASS: ViewStyle | undefined =
  Platform.OS === 'web'
    ? ({
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: 'inset 0px 1px 0px 0px rgba(255, 255, 255, 0.14)',
      } as ViewStyle)
    : undefined;

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
    className="h-[56px] w-full items-center justify-center rounded-[16px] bg-brand px-8 active:opacity-80 web:hover:opacity-90"
  >
    <Text className="text-[17px] font-semibold leading-[17px] text-black">{label}</Text>
  </Pressable>
);

const SecondaryButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    className="h-[56px] w-full items-center justify-center rounded-[16px] bg-card px-8 active:opacity-80 web:hover:bg-card-hover"
  >
    <Text className="text-[17px] font-semibold text-white">{label}</Text>
  </Pressable>
);

/** The Solid lockup, from the onboarding landing's own SVGs, scaled to `width`. */
const SolidLockup = ({ width }: { width: number }) => {
  const scale = width / LOGO_LOCKUP.width;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Solid"
      style={{ width, height: LOGO_LOCKUP.height * scale }}
    >
      <Image
        source={getAsset('images/onboarding-landing-mark.svg')}
        alt=""
        contentFit="fill"
        style={{
          position: 'absolute',
          top: LOGO_LOCKUP.markTop * scale,
          left: 0,
          width: 21.098 * scale,
          height: 24.072 * scale,
        }}
      />
      <Image
        source={getAsset('images/onboarding-landing-solid.svg')}
        alt=""
        contentFit="fill"
        style={{
          position: 'absolute',
          top: 0,
          left: LOGO_LOCKUP.wordLeft * scale,
          width: 63.516 * scale,
          height: 24.903 * scale,
        }}
      />
    </View>
  );
};

/** "eli invited you" (Figma 31314:3795): a glass pill with the inviter's initial. */
const InvitedByPill = ({ name, layout }: { name: string; layout: InviteLayout['pill'] }) => (
  <View
    className="flex-row items-center gap-[10px] overflow-hidden rounded-full border border-white/40 pl-[6px] pr-4"
    style={[{ height: layout.height }, PILL_GLASS]}
  >
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)']}
      start={{ x: 0.47, y: 0 }}
      end={{ x: 0.53, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <View
      className="items-center justify-center rounded-full bg-brand"
      style={{ width: layout.avatar, height: layout.avatar }}
    >
      <Text
        className="text-center font-semibold text-black"
        style={{ fontSize: layout.initialFontSize }}
      >
        {inviterInitial(name)}
      </Text>
    </View>
    <Text className="font-medium text-white" style={{ fontSize: layout.fontSize }}>
      {`${name} invited you`}
    </Text>
  </View>
);

const Title = ({
  parts,
  layout,
  scale,
}: {
  parts: InviteTitlePart[];
  layout: InviteLayout['title'];
  /** From `inviteTitleScale`: keeps each designed line on one line on a narrow phone. */
  scale: number;
}) => (
  <Text
    accessibilityRole="header"
    className="text-center font-normal text-white"
    style={{
      fontSize: layout.fontSize * scale,
      lineHeight: layout.lineHeight * scale,
      letterSpacing: layout.letterSpacing * scale,
    }}
  >
    {/* Plain runs: the app's Text sets `verticalAlign: middle`, which on the web grows the
        line box of every line holding a nested run past the design's line height. */}
    {parts.map((part, index) => (
      <RNText key={index} className={part.accent ? 'text-brand' : undefined}>
        {part.text}
      </RNText>
    ))}
  </Text>
);

/** "How it works" (Figma 31314:3678): the three steps in one card. */
const Steps = ({ steps, layout }: { steps: string[]; layout: InviteLayout['steps'] }) => (
  <View className="w-full overflow-hidden rounded-[20px] bg-card">
    {steps.map((step, index) => (
      <View
        key={step}
        className={cn(
          'flex-row items-center gap-[14px]',
          index < steps.length - 1 && 'border-b border-white/[0.06]',
        )}
        style={{ height: layout.rowHeight, paddingHorizontal: layout.rowPaddingX }}
      >
        <View className="h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <Text className="text-[14px] font-semibold text-white/85">{index + 1}</Text>
        </View>
        <Text
          className="flex-1 font-medium text-white"
          numberOfLines={2}
          style={{ fontSize: layout.fontSize }}
        >
          {step}
        </Text>
      </View>
    ))}
  </View>
);

/** Desktop's hand-off to the phone (Figma 31314:3915): the QR beside its instructions. */
const ScanToGetTheApp = ({ url }: { url: string }) => (
  <View className="w-full flex-row items-center gap-5 overflow-hidden rounded-[20px] bg-card py-4 pl-4 pr-6">
    <View
      className="overflow-hidden rounded-[8.571px]"
      accessible
      accessibilityRole="image"
      accessibilityLabel="QR code to open this invite on your phone"
    >
      <QRCode
        value={url}
        size={QR_SIZE}
        color="white"
        backgroundColor="#1C1C1C"
        quietZone={QR_QUIET_ZONE}
      />
    </View>
    <View className="flex-1 gap-1.5">
      <Text className="text-[20px] font-semibold text-white">Scan to get the app</Text>
      <Text className="text-[15px] leading-[21px] text-white/55">
        Open your phone’s camera and point it at the code.
      </Text>
    </View>
  </View>
);

/** The phone a mobile-web visitor is on, so the button goes to the right store. */
const webDevicePlatform = (): DevicePlatform => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return 'other';
  return getDevicePlatform(navigator.userAgent, (navigator.maxTouchPoints ?? 0) > 0);
};

/** Same tab: a store link is a hand-off to the store app, not a page to come back to. */
const openStore = (url: string) => {
  if (typeof window !== 'undefined') window.location.assign(url);
};

/** A new tab on the web, the browser in the app. */
const openSite = (url: string) => {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(url).catch(() => undefined);
};

/**
 * The public invite page an invite link opens (Figma 31314:3674, "Refer page v4 —
 * version C2"): who invited the friend, what they get, how to get it, and the hand-off
 * to the app. It replaces the Webflow invite page.
 *
 * In the app it stores the code for signup and sends the friend there. On the web it is
 * also the hand-off to the app: a QR code on desktop, the store on a phone — Play
 * carrying the code as the install referrer, the App Store side copying it to the
 * clipboard for the signup screen to offer back. Someone already signed in sees the same
 * page — sending them home reads as a bug — with the header's "Log in" turned into a way
 * back to the wallet. Their device keeps no code: the invite is for new accounts and must
 * not replace the referrer an existing one already has.
 */
export default function InviteScreen({ rawCode }: { rawCode: string | undefined }) {
  const { isDesktop } = useDimension();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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

  const copy: InviteCopy = useMemo(() => inviteCopy(lookup), [lookup]);
  // What the store hand-off carries. Someone signed in keeps no code (see the effect above),
  // so neither store gets one: it would only overwrite their clipboard or seed a referrer
  // they can't use.
  const handoffCode = isSignedIn ? null : lookup?.valid ? lookup.code : code;
  const platform = useMemo(() => webDevicePlatform(), []);
  const isWeb = Platform.OS === 'web';
  const pageUrl = isWeb && typeof window !== 'undefined' ? window.location.href : '';

  const getStarted = useCallback(() => router.push(path.SIGNUP_EMAIL), []);
  const logIn = useCallback(() => router.push(path.ONBOARDING), []);
  const goToWallet = useCallback(() => router.replace(path.HOME), []);
  const learnAboutSolid = useCallback(() => openSite(SOLID_SITE_URL), []);

  const openAppStore = useCallback(async () => {
    track(TRACKING_EVENTS.GET_APP_PRESSED, { context: 'invite', store: 'ios' });
    // iOS has no install referrer: the code rides the clipboard instead, and the
    // signup screen offers to paste it back without a prompt.
    if (handoffCode) {
      await Clipboard.setStringAsync(inviteClipboardText(handoffCode)).catch(() => false);
    }
    openStore(APP_STORE_URL);
  }, [handoffCode]);

  const openPlayStore = useCallback(() => {
    track(TRACKING_EVENTS.GET_APP_PRESSED, { context: 'invite', store: 'android' });
    // The code rides along as the install referrer; the app reads it on first launch.
    openStore(handoffCode ? buildPlayStoreInviteUrl(handoffCode) : PLAY_STORE_URL);
  }, [handoffCode]);

  if (!isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  const layout = isDesktop ? DESKTOP_LAYOUT : MOBILE_LAYOUT;
  const columnWidth = Math.min(layout.columnWidth, width - 2 * layout.steps.paddingX);
  const cardWidth = inviteCardWidth(layout, width);
  const titleScale = inviteTitleScale(
    layout,
    columnWidth,
    copy.title.map(part => part.text).join(''),
  );
  const { backdrop } = layout;

  const footnote = copy.footnote ? (
    <Text
      className="w-full text-center text-white/45"
      style={{ fontSize: layout.footnote.fontSize, lineHeight: layout.footnote.lineHeight }}
    >
      {copy.footnote}
    </Text>
  ) : null;

  // Desktop web hands over to the phone with a QR. A phone browser goes to its store,
  // with the web signup a link below. The app itself has nothing to install.
  const actions = isDesktop ? (
    <>
      {pageUrl ? <ScanToGetTheApp url={pageUrl} /> : null}
      <PrimaryButton label="Continue on web" onPress={getStarted} />
      {footnote}
    </>
  ) : isWeb ? (
    <>
      <PrimaryButton
        label="Get the Solid app"
        onPress={platform === 'android' ? openPlayStore : openAppStore}
      />
      <Pressable
        onPress={getStarted}
        accessibilityRole="button"
        className="h-11 items-center justify-center active:opacity-70 web:hover:opacity-80"
      >
        <Text className="text-[16px] font-medium text-white">Continue on web</Text>
      </Pressable>
      {footnote}
    </>
  ) : (
    <>
      <PrimaryButton label="Get started" onPress={getStarted} />
      {footnote}
    </>
  );

  return (
    <View className="flex-1 bg-black">
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        {/* The light behind the hero, fading to the page's black (Figma 31314:3792–3). */}
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 top-0 overflow-hidden"
          style={{ height: backdrop.clipHeight + insets.top }}
        >
          <Image
            source={getAsset('images/invite/hero-light.jpg')}
            alt=""
            contentFit="cover"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: backdrop.lightHeight + insets.top,
              opacity: backdrop.lightOpacity,
            }}
          />
          <LinearGradient
            colors={FADE_COLORS}
            locations={FADE_LOCATIONS}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: backdrop.fadeTop + insets.top,
              height: backdrop.fadeHeight,
            }}
          />
        </View>

        <View
          className="flex-row items-center justify-between"
          style={{
            height: layout.header.height,
            marginTop: insets.top,
            paddingHorizontal: layout.header.paddingX,
          }}
        >
          <SolidLockup width={layout.header.logoWidth} />
          <Pressable
            onPress={isSignedIn ? goToWallet : logIn}
            accessibilityRole="link"
            hitSlop={8}
            className="active:opacity-70 web:hover:opacity-80"
          >
            <Text
              className="font-medium text-white/70"
              style={{ fontSize: layout.header.loginFontSize }}
            >
              {inviteHeaderLabel(isSignedIn)}
            </Text>
          </Pressable>
        </View>

        <View
          className="items-center"
          style={{
            paddingTop: layout.hero.paddingTop - layout.header.height,
            paddingBottom: layout.hero.paddingBottom,
            paddingHorizontal: layout.steps.paddingX,
          }}
        >
          {copy.inviter ? <InvitedByPill name={copy.inviter} layout={layout.pill} /> : null}
          <View
            className="w-full items-center"
            style={{
              marginTop: layout.card.marginTop,
              height: cardWidth * layout.card.boxRatio,
            }}
          >
            <Image
              source={getAsset(
                isDesktop
                  ? 'images/invite/card-glass-desktop.png'
                  : 'images/invite/card-glass-mobile.png',
              )}
              alt="The Solid Visa Platinum card"
              contentFit="contain"
              style={{ width: cardWidth, height: cardWidth / CARD_ASPECT }}
            />
          </View>
          <View style={{ paddingTop: layout.title.paddingTop, maxWidth: columnWidth }}>
            <Title parts={copy.title} layout={layout.title} scale={titleScale} />
          </View>
          <Text
            className="text-center text-white/[0.72]"
            style={{
              marginTop: layout.subtitle.paddingTop,
              maxWidth: Math.min(layout.subtitle.maxWidth, columnWidth),
              fontSize: layout.subtitle.fontSize,
              lineHeight: layout.subtitle.lineHeight,
            }}
          >
            {copy.subtitle}
          </Text>
          <View
            className="items-center"
            style={{
              width: columnWidth,
              paddingTop: layout.actions.paddingTop,
              gap: layout.actions.gap,
            }}
          >
            {actions}
          </View>
        </View>

        <View
          className="items-center"
          style={{
            paddingTop: layout.steps.paddingTop,
            paddingBottom: layout.steps.paddingBottom,
            paddingHorizontal: layout.steps.paddingX,
          }}
        >
          <View className="items-center gap-4" style={{ width: columnWidth }}>
            <Text className="text-center text-[15px] font-medium text-white/55">How it works</Text>
            <Steps steps={copy.steps} layout={layout.steps} />
          </View>
          <View style={{ width: columnWidth, paddingTop: layout.steps.learnMoreTop }}>
            <SecondaryButton label="Learn about Solid" onPress={learnAboutSolid} />
          </View>
        </View>

        <View
          className="mt-auto items-center border-t border-white/[0.06]"
          style={{
            paddingTop: layout.footer.paddingTop,
            paddingBottom: layout.footer.paddingBottom + insets.bottom,
            paddingHorizontal: layout.footer.paddingX,
          }}
        >
          <Text className="text-center text-[13px] leading-[18.2px] text-white/40">
            The Solid Card is a Visa card issued by Wirex, pursuant to a license from Visa.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
