import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';

import ApplePayCircle from '@/assets/images/apple-pay-circle';
import CardDeclined from '@/assets/images/card-declined';
import EuroCircle from '@/assets/images/euro-circle';
import FaceScan from '@/assets/images/face-scan';
import FundDollar from '@/assets/images/fund-dollar';
import GooglePayCircle from '@/assets/images/google-pay-circle';
import { EASE_OUT_QUINT } from '@/components/Card/NewCardDetails/heroMotion';
import { HOME_BANNER_RADIUS } from '@/components/Home/NewHome/homeBannerStyle';
import HomeCashbackCtaBanner from '@/components/Home/NewHome/HomeCashbackCtaBanner';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEVICE_DIGITAL_WALLET, DigitalWalletType } from '@/constants/digital-wallet';
import { cardInfoWalletGuidePath, cardTransactionDetailPath, path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardStatus } from '@/hooks/useCardStatus';
import { DeclinedPaymentPrompt, useDeclinedPaymentPrompt } from '@/hooks/useDeclinedPaymentPrompt';
import { useUnusableEurc } from '@/hooks/useUnusableEurc';
import { track } from '@/lib/analytics';
import { CardProvider } from '@/lib/types';
import { formatCardCurrency } from '@/lib/utils/cardCurrency';
import {
  DismissibleHomePromptKey,
  HomePromptKey,
  homePromptSnoozeDays,
  useHomePromptStore,
} from '@/store/useHomePromptStore';

import type { Href } from 'expo-router';

// Figma: Mona Sans / Bold 700 / 18px / line-height 100%.
const TITLE_STYLE = { fontFamily: 'MonaSans_700Bold', fontSize: 18, lineHeight: 18 } as const;

/**
 * The wallet the "Add to …" banner names. The Apple fallback is only there to
 * keep CONTENT total off-device: `resolveHomePromptStep` never picks this banner
 * where there is no wallet to add to.
 */
const BANNER_WALLET = DEVICE_DIGITAL_WALLET ?? DigitalWalletType.Apple;
const IS_GOOGLE_WALLET = BANNER_WALLET === DigitalWalletType.Google;

interface PromptContent {
  title: string;
  description: string;
  icon: React.ReactNode;
  /**
   * The CTA label and where it goes. Absent only on the banner the user cannot
   * act on: a verification still under review is news, not a next step, so the
   * design draws no button on it.
   *
   * A declined verification used to be in that set too (Figma 25141:7189 draws
   * no button). It is not any more. "Declined" with no button and no reason was
   * a dead end — the home screen said the application had failed and offered no
   * way to find out why, which is what users reported as "KYC, no option". The
   * card screen has carried the provider's own reason for the decline all
   * along; this banner just never let anyone reach it.
   *
   * `href` is a redirect, which is what every banner but one does. `onPress` is
   * for "Turn on euro spending", whose flow is a single signature with nothing to
   * navigate to; `busy` shows it in flight.
   */
  cta?: { label: string; href?: Href; onPress?: () => void; busy?: boolean };
}

/** The banners whose copy never changes. The two Wirex steps carry figures — see `wirexContent`. */
type StaticPromptKey = Exclude<HomePromptKey, 'cashback' | 'card-declined' | 'euro-spending'>;

// Figma 28856:9574 / 25141:7265 — on ✕ the banner fades out and lifts 18pt before it goes:
// opacity over 420ms ease-out, the lift over 460ms on the same quint curve the card hero uses.
const DISMISS_FADE_MS = 420;
const DISMISS_LIFT_MS = 460;
const DISMISS_LIFT = -18;

/**
 * One banner per rung of the card funnel (Figma 25141:6965). `useHomePrompt`
 * decides which rung the user is on; this is only the copy and the destination.
 *
 * Every CTA here is a plain redirect — the banner navigates and nothing else, so the
 * screen it lands on stays the single owner of the flow (starting KYC, opening
 * the deposit sheet, provisioning the card). `/card/activate` is the one door
 * into issuance for all three verification banners: it runs the country gate for
 * a first-timer and resumes an application or a pending card for everyone else.
 *
 * The EURC banner (see `wirexContent`) is a redirect too: to Main currency, where the
 * one-time approval that lets the card pay with EURC is.
 */
const CONTENT: Record<StaticPromptKey, PromptContent> = {
  // Figma 25141:7075
  'get-card': {
    title: 'Get your card',
    description: '2 minutes and your Visa card is ready',
    icon: <FaceScan />,
    cta: { label: 'Get verified', href: path.CARD_ACTIVATE },
  },
  // Figma 25141:7131
  verification: {
    title: 'Finish verification',
    description: '2 minutes and your Visa card is ready',
    icon: <FaceScan />,
    cta: { label: 'Get verified', href: path.CARD_ACTIVATE },
  },
  // Figma 25141:7153. Typos in the drawn copy are fixed here ("by mail" was
  // meant to be email — this is the mail the KYC webhooks send).
  'kyc-review': {
    title: 'Your card is on its way',
    description:
      'Your identity is now being verified. You will be notified by email once you get approved',
    icon: <FaceScan />,
  },
  // Figma 25141:7189 — the same face with a flat mouth instead of a smile.
  // The CTA is deliberately not drawn in that frame; see `cta` above for why it
  // is here anyway. It goes to the same `/card/activate` as every other
  // verification banner, which is the only screen that renders the decline
  // reason the provider gave.
  'kyc-rejected': {
    title: 'Your verification declined',
    description: 'Unfortunately, we were unable to approve your identity verification',
    icon: <FaceScan expression="flat" />,
    cta: { label: 'See why', href: path.CARD_ACTIVATE },
  },
  // Figma 25141:7224
  'activate-card': {
    title: 'Your Solid card is ready!',
    description: 'Activate your virtual card to start spending anywhere',
    icon: <FaceScan />,
    cta: { label: 'Activate card', href: path.CARD_ACTIVATE },
  },
  // Not drawn in Figma: the activate-card banner, re-worded for a cardholder
  // whose card was closed. Same door — /card/activate, whose activate step
  // orders the replacement.
  'replace-card': {
    title: 'Your card was closed',
    description: 'Get a new virtual card with a new number. Your balance stays where it is',
    icon: <FaceScan />,
    cta: { label: 'Get new card', href: path.CARD_ACTIVATE },
  },
  // Figma 25141:7265
  fund: {
    title: 'Fund your wallet',
    description: 'Add funds to start spending with your card',
    icon: <FundDollar />,
    cta: { label: 'Fund your wallet', href: path.DEPOSIT },
  },
  // Figma 25141:7278. The design draws the iOS state; Android gets the same
  // banner named for the wallet that phone actually has.
  'add-to-wallet': {
    title: IS_GOOGLE_WALLET ? 'Add to Google Wallet' : 'Add to Apple Pay',
    description: 'To pay with your phone',
    icon: IS_GOOGLE_WALLET ? <GooglePayCircle /> : <ApplePayCircle />,
    // Card details with the wallet guide already open on the right tab — the
    // popup is addressable precisely so this stays a redirect.
    cta: {
      label: IS_GOOGLE_WALLET ? 'Add to Google Wallet' : 'Add to Apple Pay',
      href: cardInfoWalletGuidePath(BANNER_WALLET),
    },
  },
};

/**
 * The two Wirex steps, whose copy carries the cardholder's own figures — the declined payment and
 * what they have now, or the EURC their card cannot reach. `undefined` while the figures are not
 * in, which renders nothing rather than a banner with blanks in it.
 */
function wirexContent(
  key: 'card-declined' | 'euro-spending',
  {
    declined,
    eurc,
  }: {
    declined: DeclinedPaymentPrompt | null;
    eurc: number;
  },
): PromptContent | undefined {
  if (key === 'card-declined') {
    if (!declined) return undefined;
    const { payment, available, merchantName, transactionId } = declined;
    // Figma 28856:9595: "€18.75 at Corner Market. You have €0 available to spend."
    return {
      title: 'Your payment was declined',
      description:
        `${formatCardCurrency(payment.amount, payment.currency)}` +
        `${merchantName ? ` at ${merchantName}` : ''}. ` +
        `You have ${formatCardCurrency(available.amount, available.currency, { wholeZero: true })} available to spend.`,
      icon: <CardDeclined />,
      // The receipt is where the fix is — the right one of Add funds, Swap or Turn on.
      cta: { label: 'Fix it', href: cardTransactionDetailPath(transactionId) },
    };
  }

  if (eurc <= 0) return undefined;
  // Figma 28856:9637. The euro figure rounded down: it is what the card would reach.
  return {
    title: 'Let your card pay with EURC',
    description: `Your ${formatCardCurrency(Math.floor(eurc * 100) / 100, 'EUR')} EURC can't be used by your card yet.`,
    icon: <EuroCircle />,
    cta: { label: 'Turn on', href: path.CARD_MAIN_CURRENCY },
  };
}

interface HomePromptCardProps {
  /** Which banner to show — resolved by `useHomePrompt`. */
  promptKey: HomePromptKey;
  /** Whether the user has already funded their account (deposit step). */
  depositCompleted: boolean;
  className?: string;
}

/**
 * The next-step CTA banner on the wallet screen — one card, always showing the
 * step the user is actually on (Figma 25141:6965).
 *
 * Which variant renders is decided by `useHomePrompt` from the user's card and
 * verification state, and it covers both issuers: Rain/Didit and Wirex/Sumsub
 * are folded into one ladder upstream, so nothing here branches on provider.
 *
 * Every variant but the last can be dismissed with the ✕; that dismissal is a
 * snooze persisted on the device, so the banner reappears once its window is up
 * (see `useHomePromptStore`). The final cashback banner has no ✕ at all and
 * stays for good — it is delegated to `HomeCashbackCtaBanner`, which draws the
 * design's different layout for it.
 *
 * Separate from the legacy HomeCardSetup so the public/legacy home is unaffected.
 */
const HomePromptCard = ({ promptKey, depositCompleted, className }: HomePromptCardProps) => {
  const dismiss = useHomePromptStore(state => state.dismiss);
  const dismissDecline = useHomePromptStore(state => state.dismissDecline);
  const { data: cardStatus } = useCardStatus();
  const { provider } = useCardProvider();
  // Only read for the two Wirex steps; off — and free — for every other banner.
  const declined = useDeclinedPaymentPrompt(
    promptKey === 'card-declined' && provider === CardProvider.WIREX,
  );
  const { eurc } = useUnusableEurc();

  const opacity = useSharedValue(1);
  const lift = useSharedValue(0);
  const exitStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }],
  }));

  // The slot can go straight on to the next rung once this one is dismissed, and
  // that banner must arrive at rest, not still faded from the last one.
  const declinedId = declined?.transactionId;
  useEffect(() => {
    opacity.value = 1;
    lift.value = 0;
  }, [promptKey, declinedId, opacity, lift]);

  // The terminal banner is a different card entirely: no icon, no CTA, no ✕.
  if (promptKey === 'cashback') return <HomeCashbackCtaBanner className={className} />;

  const content =
    promptKey === 'card-declined' || promptKey === 'euro-spending'
      ? wirexContent(promptKey, { declined, eurc })
      : CONTENT[promptKey];
  if (!content) return null;

  const { title, description, icon, cta } = content;

  // Narrowed by the early return above: every banner that reaches here has a ✕.
  const dismissibleKey: DismissibleHomePromptKey = promptKey;

  // A decline is closed for that payment only; every other banner snoozes.
  const closeBanner = () => {
    if (dismissibleKey === 'card-declined') {
      if (declinedId) dismissDecline(declinedId);
      return;
    }
    dismiss(dismissibleKey);
  };

  const onPressDismiss = () => {
    // Which banner was closed, how long that buys, and where the user was in the
    // funnel — enough to tell "snoozed a nudge they'd already acted on" from
    // "gave up on verification" without an event per variant.
    track(TRACKING_EVENTS.HOME_PROMPT_DISMISSED, {
      prompt: dismissibleKey,
      snoozeDays: dismissibleKey === 'card-declined' ? 0 : homePromptSnoozeDays(dismissibleKey),
      kycStatus: cardStatus?.kycStatus,
      rainApplicationStatus: cardStatus?.rainApplicationStatus,
      depositCompleted,
      ...(declinedId && dismissibleKey === 'card-declined' && { transactionId: declinedId }),
    });
    opacity.value = withTiming(0, { duration: DISMISS_FADE_MS, easing: Easing.out(Easing.ease) });
    lift.value = withTiming(
      DISMISS_LIFT,
      { duration: DISMISS_LIFT_MS, easing: EASE_OUT_QUINT },
      finished => {
        if (finished) scheduleOnRN(closeBanner);
      },
    );
  };

  const onPressCta = (action: NonNullable<PromptContent['cta']>) => () => {
    track(TRACKING_EVENTS.HOME_PROMPT_CTA_PRESSED, {
      prompt: promptKey,
      kycStatus: cardStatus?.kycStatus,
      rainApplicationStatus: cardStatus?.rainApplicationStatus,
      depositCompleted,
    });
    if (action.onPress) {
      action.onPress();
      return;
    }
    if (action.href) router.push(action.href);
  };

  return (
    <Animated.View className={className} style={exitStyle}>
      <View className="overflow-hidden bg-card p-5" style={{ borderRadius: HOME_BANNER_RADIUS }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-1 pr-4">
            <Text className="text-foreground" style={TITLE_STYLE}>
              {title}
            </Text>
            {/* Figma: 14px / 16px line-height / rgba(255,255,255,0.7) — the same
                white/70 the cashback banner below and the card sheets use, not
                `text-muted-foreground`, which is a good deal darker. */}
            <Text className="text-sm leading-4 text-white/70">{description}</Text>
            {cta && (
              <Button
                variant="brand"
                size="sm"
                className="mt-4 h-[35px] self-start rounded-full px-4"
                disabled={cta.busy}
                onPress={onPressCta(cta)}
              >
                {cta.busy ? (
                  <ActivityIndicator color="black" size="small" />
                ) : (
                  <Text className="text-base font-semibold text-primary-foreground">
                    {cta.label}
                  </Text>
                )}
              </Button>
            )}
          </View>
          {/* Figma sits the art ~45px in from the card edge; the card's own
              20px padding covers most of that. */}
          <View className="mr-6">{icon}</View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Dismiss ${title}`}
          onPress={onPressDismiss}
          hitSlop={16}
          className="absolute right-[10px] top-[11px]"
        >
          <X size={24} color="rgba(255,255,255,0.5)" strokeWidth={2} />
        </Pressable>
      </View>
    </Animated.View>
  );
};

export default HomePromptCard;
