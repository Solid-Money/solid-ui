import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';

import {
  OnboardingStepNumber,
  OnboardingStepper,
} from '@/components/Card/WirexOnboarding/OnboardingStepper';
import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

/**
 * The new Solid card, tilted, with its glow (Figma `card-waiting-hero.png`, 339×243 in the
 * status panel). Replaces `card-fade.png` on every Wirex onboarding screen.
 */
export const CardWaitingHero = ({ dimmed = false }: { dimmed?: boolean }) => (
  <Image
    source={getAsset('images/card-waiting-hero.png')}
    alt="Solid card"
    style={{ width: 339, height: 243, maxWidth: '100%', opacity: dimmed ? 0.45 : 1 }}
    contentFit="contain"
  />
);

interface WirexOnboardingLayoutProps {
  /** Which of Country, Verify, Activate the screen belongs to. Omitted on the off-path screens. */
  step?: OnboardingStepNumber;
  children: ReactNode;
  /** Pinned under the content: the screen's next step. */
  footer?: ReactNode;
  /** Back button handler. The default goes back, or to the wallet with nowhere to go back to. */
  onBack?: () => void;
  /** The Activating screen has no back button: there is nowhere safe to go mid-activation. */
  hideBack?: boolean;
}

/**
 * The frame every Wirex onboarding screen shares (Figma "Wirex card onboarding · proposal v2"):
 * the "Solid card" header, the 3-step indicator, the screen's content, and its call to action
 * pinned to the bottom.
 *
 * The header is `CardStatusPage`'s own, so these screens sit in the same family as every other
 * card status screen.
 */
export function WirexOnboardingLayout({
  step,
  children,
  footer,
  onBack,
  hideBack = false,
}: WirexOnboardingLayoutProps) {
  return (
    <PageLayout desktopOnly scrollable={false}>
      <View className="mx-auto w-full max-w-lg flex-1 px-4 pt-8">
        <View className="flex-row items-center justify-between">
          {hideBack ? <View style={{ width: 50 }} /> : <BackButton onPress={onBack} />}
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Solid card
          </Text>
          <View style={{ width: 50 }} />
        </View>

        {step ? (
          <View className="mt-6">
            <OnboardingStepper current={step} />
          </View>
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: step ? 28 : 32, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        {footer ? <View className="pb-6 pt-3">{footer}</View> : null}
      </View>
    </PageLayout>
  );
}

export default WirexOnboardingLayout;
