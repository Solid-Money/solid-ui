import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';

import { WirexActivating } from '@/components/Card/WirexOnboarding/WirexActivating';
import { WirexCardApproval } from '@/components/Card/WirexOnboarding/WirexCardApproval';
import {
  CardWaitingHero,
  WirexOnboardingLayout,
} from '@/components/Card/WirexOnboarding/WirexOnboardingLayout';
import {
  WirexActivationFailed,
  WirexChecking,
  WirexDeclined,
  WirexMoreDocuments,
  WirexNeedsSupport,
} from '@/components/Card/WirexOnboarding/WirexStatusScreens';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useRainSunset } from '@/hooks/useRainSunset';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { KycProvider } from '@/lib/types';
import { blocksNewCard, closesPhrase, formatClosingBalance } from '@/lib/utils/rainSunset';
import { resolveWirexOnboardingStep } from '@/lib/utils/wirexOnboarding';
import { useKycStore } from '@/store/useKycStore';

import type { AssetPath } from '@/lib/assets';

const BENEFITS: { icon: AssetPath; title: string; description: string }[] = [
  {
    icon: 'images/card-new-card-wallet.svg',
    title: 'Spends straight from your wallet',
    description: 'No more moving money onto the card',
  },
  {
    icon: 'images/card-new-card-euro.svg',
    title: 'Pay in dollars or euros',
    description: 'Spend your USDC or EURC',
  },
  {
    icon: 'images/card-new-card-phone.svg',
    title: 'Apple Pay and Google Pay',
    description: 'Add it to your phone once it’s ready',
  },
];

/**
 * "Get your new Solid card" (Figma "8 · Get your new Solid card", 30567:15292),
 * offered from day one rather than after the old card closes: the new card
 * partner only accepts its own identity check, so the cardholder verifies once
 * more, and the old card closes when the new one is issued.
 */
function NewCardIntro({
  hasCurrentCard,
  closesAt,
  resuming,
  balanceUsd,
  blocked,
  onStart,
  onNotNow,
}: {
  /** They still hold the closing card; a Rain applicant with no card does not. */
  hasCurrentCard: boolean;
  closesAt: string | null;
  resuming: boolean;
  balanceUsd: number | null;
  blocked: boolean;
  onStart: () => void;
  onNotNow: () => void;
}) {
  return (
    <WirexOnboardingLayout
      onBack={onNotNow}
      footer={
        <View style={styles.buttons}>
          <Button variant="brand" className="h-[54px] w-full rounded-full" onPress={onStart}>
            <Text className="text-[17px] font-semibold text-black">
              {resuming ? 'Continue verification' : 'Get my new card'}
            </Text>
          </Button>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            onPress={onNotNow}
            style={styles.notNow}
          >
            <Text className="text-[16px] font-semibold text-white/70">Not now</Text>
          </Pressable>
        </View>
      }
    >
      <View className="items-center gap-5">
        <CardWaitingHero />
        <View className="w-full gap-2">
          <Text className="text-center text-[28px] font-semibold leading-[34px] text-white">
            {hasCurrentCard ? 'Get your new Solid card' : 'Get your Solid card'}
          </Text>
          <Text className="text-center text-[15px] leading-[21px] text-white/70">
            {hasCurrentCard
              ? `Your current card closes ${closesPhrase(closesAt, 'long')}. Your new card comes from our new card partner, Wirex, so you'll verify your identity once more.`
              : "Solid cards now come from our new card partner, Wirex, so you'll verify your identity with them. It takes a few minutes."}
          </Text>
        </View>
        <View style={styles.benefits}>
          {BENEFITS.map((benefit, index) => (
            <View key={benefit.title}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.benefit}>
                <Image source={getAsset(benefit.icon)} style={styles.benefitIcon} />
                <View style={styles.benefitText}>
                  <Text className="text-[16px] font-medium text-white">{benefit.title}</Text>
                  <Text className="text-[13px] text-white/55">{benefit.description}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
        <Text className="text-center text-[14px] leading-[20px] text-white/50">
          You’ll need your ID, a selfie and proof of address. It takes a few minutes.
        </Text>
        {blocked && balanceUsd != null ? (
          <Text className="text-center text-[14px] leading-[20px] text-white/50">
            {`Withdraw the ${formatClosingBalance(balanceUsd)} on your current card before your new card is issued.`}
          </Text>
        ) : null}
      </View>
    </WirexOnboardingLayout>
  );
}

/**
 * The cardholder's move to their new card, screen by screen: the intro above,
 * then the same Wirex onboarding screens a first-time applicant sees, read from
 * the move's own status (`rainSunset.migration`) — their card status still
 * describes the card they hold until the new one exists.
 */
export function RainNewCardScreen() {
  const router = useRouter();
  const { sunset, isLoading, balanceUsd } = useRainSunset();
  const setKycFlow = useKycStore(state => state.setKycFlow);
  const setKycProvider = useKycStore(state => state.setKycProvider);

  const migration = sunset?.migration;
  const step = migration ? resolveWirexOnboardingStep(migration) : 'verify';

  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current || !sunset) return;
    tracked.current = true;
    track(TRACKING_EVENTS.CARD_ONBOARDING_STEP_VIEWED, {
      step: `rain_sunset_${step}`,
      new_card_available: sunset.newCardAvailable,
    });
  }, [sunset, step]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  // Nothing to move: already moved (the status no longer carries the block), or
  // no new card where they live. Their card screen says why.
  if (!sunset || (!sunset.newCardAvailable && !migration)) {
    return <Redirect href={path.CARD_INFO} />;
  }

  const goToCard = () => router.replace(path.CARD_INFO);
  const startKyc = () => {
    track(TRACKING_EVENTS.CARD_ONBOARDING_CTA_PRESSED, { step: 'rain_sunset_verify' });
    setKycFlow('card_migration');
    setKycProvider(KycProvider.SUMSUB);
    router.push(path.SUMSUB_KYC);
  };

  switch (step) {
    case 'more-documents':
      return (
        <WirexMoreDocuments
          warnings={migration?.kycWarnings}
          onContinue={startKyc}
          onBack={goToCard}
        />
      );
    case 'checking':
      return <WirexChecking onGoHome={() => router.replace(path.HOME)} onBack={goToCard} />;
    case 'declined':
      return <WirexDeclined onContinue={goToCard} onBack={goToCard} />;
    case 'support':
      return <WirexNeedsSupport onBack={goToCard} />;
    case 'activation-failed':
      return (
        <WirexActivationFailed
          failure={migration?.activationFailure}
          isBlocked={Boolean(migration?.activationBlocked)}
          blockedReason={migration?.activationBlockedReason ?? ''}
          onRetry={() => router.replace(path.CARD_NEW_CARD)}
          onBack={goToCard}
        />
      );
    case 'approved':
      return <WirexCardApproval migrationStatus={migration} />;
    case 'creating':
      return (
        <WirexActivating
          items={[
            { label: 'Identity verified', doneLabel: 'Identity verified', state: 'done' },
            { label: 'Opening your new card…', doneLabel: 'Card opened', state: 'active' },
          ]}
        />
      );
    case 'verify':
    default:
      return (
        <NewCardIntro
          hasCurrentCard={sunset.hasRainCard}
          closesAt={sunset.closesAt}
          resuming={Boolean(migration?.kycReviewStatus)}
          balanceUsd={balanceUsd}
          blocked={blocksNewCard(balanceUsd, sunset)}
          onStart={startKyc}
          onNotNow={goToCard}
        />
      );
  }
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111111' },
  buttons: { gap: 4 },
  notNow: { height: 48, alignItems: 'center', justifyContent: 'center' },
  benefits: {
    alignSelf: 'stretch',
    backgroundColor: '#1C1C1C',
    borderRadius: 23,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  benefitIcon: { width: 36, height: 36 },
  benefitText: { flex: 1, gap: 2 },
});

export default RainNewCardScreen;
