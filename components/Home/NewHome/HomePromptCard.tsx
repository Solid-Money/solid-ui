import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';

import ApplePayCircle from '@/assets/images/apple-pay-circle';
import FaceScan from '@/assets/images/face-scan';
import FundDollar from '@/assets/images/fund-dollar';
import GooglePayCircle from '@/assets/images/google-pay-circle';
import { HOME_BANNER_RADIUS } from '@/components/Home/NewHome/homeBannerStyle';
import HomeCashbackCtaBanner from '@/components/Home/NewHome/HomeCashbackCtaBanner';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEVICE_DIGITAL_WALLET, DigitalWalletType } from '@/constants/digital-wallet';
import { cardInfoWalletGuidePath, path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { track } from '@/lib/analytics';
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
   * The CTA label and where it goes. Absent on the two banners the user cannot
   * act on — a verification under review and a declined one are both news, not
   * a next step, so the design draws no button on either.
   */
  cta?: { label: string; href: Href };
}

/**
 * One banner per rung of the card funnel (Figma 25141:6965). `useHomePrompt`
 * decides which rung the user is on; this is only the copy and the destination.
 *
 * Every CTA is a plain redirect — the banner navigates and nothing else, so the
 * screen it lands on stays the single owner of the flow (starting KYC, opening
 * the deposit sheet, provisioning the card). `/card/activate` is the one door
 * into issuance for all three verification banners: it runs the country gate for
 * a first-timer and resumes an application or a pending card for everyone else.
 */
const CONTENT: Record<Exclude<HomePromptKey, 'cashback'>, PromptContent> = {
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
  'kyc-rejected': {
    title: 'Your verification declined',
    description: 'Unfortunately, we were unable to approve your identity verification',
    icon: <FaceScan expression="flat" />,
  },
  // Figma 25141:7224
  'activate-card': {
    title: 'Your Solid card is ready!',
    description: 'Activate your virtual card to start spending anywhere',
    icon: <FaceScan />,
    cta: { label: 'Activate card', href: path.CARD_ACTIVATE },
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
  const { data: cardStatus } = useCardStatus();

  // The terminal banner is a different card entirely: no icon, no CTA, no ✕.
  if (promptKey === 'cashback') return <HomeCashbackCtaBanner className={className} />;

  const { title, description, icon, cta } = CONTENT[promptKey];

  // Narrowed by the early return above: every banner that reaches here has a ✕.
  const dismissibleKey: DismissibleHomePromptKey = promptKey;

  const onPressDismiss = () => {
    // Which banner was closed, how long that buys, and where the user was in the
    // funnel — enough to tell "snoozed a nudge they'd already acted on" from
    // "gave up on verification" without an event per variant.
    track(TRACKING_EVENTS.HOME_PROMPT_DISMISSED, {
      prompt: dismissibleKey,
      snoozeDays: homePromptSnoozeDays(dismissibleKey),
      kycStatus: cardStatus?.kycStatus,
      rainApplicationStatus: cardStatus?.rainApplicationStatus,
      depositCompleted,
    });
    dismiss(dismissibleKey);
  };

  const onPressCta = (destination: Href) => () => {
    track(TRACKING_EVENTS.HOME_PROMPT_CTA_PRESSED, {
      prompt: promptKey,
      kycStatus: cardStatus?.kycStatus,
      rainApplicationStatus: cardStatus?.rainApplicationStatus,
      depositCompleted,
    });
    router.push(destination);
  };

  return (
    <View className={className}>
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
                onPress={onPressCta(cta.href)}
              >
                <Text className="text-base font-semibold text-primary-foreground">{cta.label}</Text>
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
    </View>
  );
};

export default HomePromptCard;
