import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { CardStatusBanner } from '@/components/Card/ActivateCard';
import { CardStatusPanel } from '@/components/Card/CardStatusPage';
import {
  CardWaitingHero,
  WirexOnboardingLayout,
} from '@/components/Card/WirexOnboarding/WirexOnboardingLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { CardActivationFailure, KycWarning } from '@/lib/types';
import { describeResubmission, WirexOnboardingStep } from '@/lib/utils/wirexOnboarding';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

/** One "viewed" event per screen visit, for the onboarding funnel. */
function useStepViewed(step: WirexOnboardingStep, properties?: Record<string, unknown>) {
  // Once per step: the properties only label it.
  const trackedStepRef = useRef<WirexOnboardingStep | null>(null);
  useEffect(() => {
    if (trackedStepRef.current === step) return;
    trackedStepRef.current = step;
    track(TRACKING_EVENTS.CARD_ONBOARDING_STEP_VIEWED, { step, ...properties });
  }, [step, properties]);
}

const ctaPressed = (step: WirexOnboardingStep, cta: string) =>
  track(TRACKING_EVENTS.CARD_ONBOARDING_CTA_PRESSED, { step, cta });

/** Dark pill button, the design's secondary action (Go to Home). */
const SecondaryButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Button variant="secondary" className="h-[50px] w-full rounded-[30px] border-0" onPress={onPress}>
    <Text className="text-base font-semibold text-white">{label}</Text>
  </Button>
);

/** Text-only action under a primary button (Contact support). */
const TextAction = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    className="mt-3 h-11 items-center justify-center web:hover:opacity-70"
  >
    <Text className="text-base font-semibold text-white">{label}</Text>
  </Pressable>
);

/**
 * "We're checking your details" (Figma 4 · Checking your details): submitted, and Sumsub or Wirex
 * is deciding. The applicant can leave — the approval push and email bring them back — and the
 * screen moves on by itself if the decision lands while it is open.
 */
export function WirexChecking({ onGoHome, onBack }: { onGoHome: () => void; onBack?: () => void }) {
  useStepViewed('checking');

  return (
    <WirexOnboardingLayout
      step={2}
      onBack={onBack}
      footer={
        <SecondaryButton
          label="Go to Home"
          onPress={() => {
            ctaPressed('checking', 'go_home');
            onGoHome();
          }}
        />
      }
    >
      <CardStatusPanel
        title="We’re checking your details"
        description="You can close the app. We’ll send you a notification as soon as you’re approved."
        image={<CardWaitingHero />}
      />
    </WirexOnboardingLayout>
  );
}

/**
 * "More documents needed" (Figma, exceptions): Sumsub asked for a resend. The reason gets its own
 * screen, in plain words, instead of a line inside a steps list — and the button reopens Sumsub,
 * which picks up the check where it stopped.
 */
export function WirexMoreDocuments({
  warnings,
  onContinue,
  onBack,
  isStarting,
}: {
  warnings?: KycWarning[] | null;
  onContinue: () => void;
  onBack?: () => void;
  isStarting?: boolean;
}) {
  const { title, body } = describeResubmission(warnings);
  useStepViewed('more-documents', { reasons: (warnings ?? []).map(warning => warning.risk) });

  return (
    <WirexOnboardingLayout
      step={2}
      onBack={onBack}
      footer={
        <Button
          variant="brand"
          className="w-full"
          disabled={isStarting}
          onPress={() => {
            ctaPressed('more-documents', 'continue_verification');
            onContinue();
          }}
        >
          {isStarting ? <ActivityIndicator color="#000000" /> : <Text>Continue verification</Text>}
        </Button>
      }
    >
      <CardStatusPanel
        title={title}
        description={body}
        image={<CardWaitingHero />}
        badge={
          <View
            className="rounded-xl px-2.5 py-1"
            style={{ backgroundColor: 'rgba(245,196,81,0.14)' }}
          >
            <Text className="text-xs font-medium text-[#F5C451]">Action needed</Text>
          </View>
        }
      />
    </WirexOnboardingLayout>
  );
}

/**
 * "We can't issue you a card" (Figma, exceptions): a final decline. No reason on purpose — most
 * are compliance decisions (watchlists, PEP, fraud) that were being read back to applicants word
 * for word, which the Rain flow has never done — and a way back into everything else Solid does.
 */
export function WirexDeclined({
  onContinue,
  onBack,
}: {
  onContinue: () => void;
  onBack?: () => void;
}) {
  useStepViewed('declined');

  return (
    <WirexOnboardingLayout
      onBack={onBack}
      footer={
        <View>
          <Button
            variant="brand"
            className="w-full"
            onPress={() => {
              ctaPressed('declined', 'continue_to_app');
              onContinue();
            }}
          >
            <Text>Continue to the app</Text>
          </Button>
          <TextAction
            label="Contact support"
            onPress={() => {
              ctaPressed('declined', 'contact_support');
              openSupportDrawer();
            }}
          />
        </View>
      }
    >
      <CardStatusPanel
        title="We can’t issue you a card"
        description="Our verification partner couldn’t approve your application. Your Solid account still works: deposits, Earn, Send and rewards are all yours."
        image={<CardWaitingHero dimmed />}
      />
    </WirexOnboardingLayout>
  );
}

/**
 * The hand-off to Wirex failed for good on our side. Verification passed, so sending the applicant
 * back into Sumsub only finds a finished check; support can re-drive the hand-off.
 */
export function WirexNeedsSupport({ onBack }: { onBack?: () => void }) {
  useStepViewed('support');

  return (
    <WirexOnboardingLayout
      step={2}
      onBack={onBack}
      footer={
        <Button
          variant="brand"
          className="w-full"
          onPress={() => {
            ctaPressed('support', 'contact_support');
            openSupportDrawer();
          }}
        >
          <Text>Contact support</Text>
        </Button>
      }
    >
      <CardStatusPanel
        title="We’re finishing your application"
        description="Your identity check passed, but something on our side needs a look before we can open your card. Our support team can sort it out."
        image={<CardWaitingHero />}
      />
    </WirexOnboardingLayout>
  );
}

/**
 * Approved, but opening the card failed. The issuer's reason is the existing banner's — it already
 * says whether trying again can help — under the Activate step it happened on.
 */
export function WirexActivationFailed({
  failure,
  isBlocked,
  blockedReason,
  onRetry,
  onBack,
}: {
  failure?: CardActivationFailure;
  isBlocked: boolean;
  blockedReason: string;
  onRetry: () => void;
  onBack?: () => void;
}) {
  useStepViewed('activation-failed', { failure_code: failure?.code });

  return (
    <WirexOnboardingLayout step={3} onBack={onBack}>
      <CardStatusPanel title="We couldn’t open your card" image={<CardWaitingHero dimmed />}>
        <View className="mt-4 w-full">
          <CardStatusBanner
            isPending={false}
            isBlocked={isBlocked}
            blockedReason={blockedReason}
            failure={failure}
            onRetry={onRetry}
          />
        </View>
      </CardStatusPanel>
    </WirexOnboardingLayout>
  );
}
