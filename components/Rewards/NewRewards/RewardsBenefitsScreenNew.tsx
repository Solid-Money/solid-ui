import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';

import {
  SIDEBAR_BODY_TOP_GUTTER,
  SIDEBAR_BODY_WIDTH,
  useIsSidebarShell,
  usePageWidth,
} from '@/components/Navbar/Sidebar';
import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useRewardsUserData, useTierBenefits } from '@/hooks/useRewards';
import { useSavingsFundFlow } from '@/hooks/useSavingsFundFlow';
import { useTierMembership } from '@/hooks/useTierMembership';
import { isHigherTier } from '@/lib/rewardsUpgrade';
import { availableRoutes, findOffer } from '@/lib/tierUpgrade';
import { RewardsTier } from '@/lib/types';
import { useSwapState } from '@/store/swapStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useTierUpgradeStore } from '@/store/useTierUpgradeStore';
import { useUserStore } from '@/store/useUserStore';

import { TierBenefitsBackground, TierBenefitsPage } from './TierBenefitsPage';
import { TIER_LABELS, tierOfferSubtitle } from './tierBenefitsPresentation';
import TierPointsSheet from './TierPointsSheet';
import TierSwitcher from './TierSwitcher';
import { type TierUpgradeCta, tierUpgradeCta } from './tierUpgradeCta';
import UpgradeTierSheet from './UpgradeTierSheet';

const TIERS = [RewardsTier.CORE, RewardsTier.PRIME, RewardsTier.ULTRA];

const HEADER_ROW_HEIGHT = 33;
/** Figma leaves 20px above the tier tabs. */
const HEADER_TOP_SPACING = 20;
const SLIDE_DURATION = 420;
const SLIDE_EASING = Easing.out(Easing.cubic);
const PREMIUM_FOOTER_SLIDE_DURATION = 360;
const PREMIUM_FOOTER_SLIDE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const SWIPE_DISTANCE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 400;
// Dampens the drag past the first/last tier so it feels like it's resisting.
const RUBBER_BAND_FACTOR = 0.3;
// bg-background (--background), used as the solid end of the top/bottom fades.
const BACKGROUND = '#0F0F10';
const PREMIUM_FOOTER_FADE_HEIGHT = 32;
const PREMIUM_FOOTER_BUTTON_HEIGHT = 50;
const PREMIUM_FOOTER_MIN_BOTTOM_SPACING = 19;
const PREMIUM_FOOTER_VERTICAL_OFFSET = 5;
// Extra height the fades extend beyond their bar's own content, so scrolled
// content dims out smoothly under the header / off the bottom edge instead of
// getting a hard clip (mirrors CardWaitingModal's FADE_EXTENT).
const FADE_EXTENT = 60;

const PremiumUpgradeFooter = ({
  selectedTier,
  onUpgradePress,
  cta,
}: {
  selectedTier: RewardsTier;
  /** The button, its subtitle and whether it does anything — see `tierUpgradeCta`. */
  cta: TierUpgradeCta;
  onUpgradePress: (tier: RewardsTier.PRIME | RewardsTier.ULTRA) => void;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { label: actionLabel, subtitle: ctaSubtitle, enabled: canUpgrade, held } = cta;
  const label = actionLabel === 'Upgrade' ? `Upgrade to ${TIER_LABELS[selectedTier]}` : actionLabel;
  // Gone, not greyed out, for any tier the user already has.
  //
  // Was `selectedTier !== currentTier`, which only ever hid the footer on the
  // one tab that matched exactly — so someone on Ultra swiping to Prime, or to
  // Core, still got a full-width dead button over the benefits they had just
  // paid for. `held` covers the tier they hold and every tier under it.
  const isVisible = !held && (selectedTier !== RewardsTier.CORE || actionLabel === 'Try again');
  const lastPremiumTier = useRef<RewardsTier.PRIME | RewardsTier.ULTRA>(RewardsTier.PRIME);

  if (selectedTier === RewardsTier.PRIME || selectedTier === RewardsTier.ULTRA) {
    lastPremiumTier.current = selectedTier;
  }

  const tier = lastPremiumTier.current;
  const bottomSpacing =
    Math.max(insets.bottom, PREMIUM_FOOTER_MIN_BOTTOM_SPACING) + PREMIUM_FOOTER_VERTICAL_OFFSET;
  const [subtitleHeight, setSubtitleHeight] = useState(23);
  const footerHeight =
    PREMIUM_FOOTER_FADE_HEIGHT +
    11 +
    subtitleHeight +
    14 +
    PREMIUM_FOOTER_BUTTON_HEIGHT +
    bottomSpacing;
  const footerTranslateY = useSharedValue(isVisible ? 0 : footerHeight);

  useEffect(() => {
    footerTranslateY.value = reduceMotion
      ? isVisible
        ? 0
        : footerHeight
      : withTiming(isVisible ? 0 : footerHeight, {
          duration: PREMIUM_FOOTER_SLIDE_DURATION,
          easing: PREMIUM_FOOTER_SLIDE_EASING,
        });
  }, [footerHeight, footerTranslateY, isVisible, reduceMotion]);

  const footerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: footerTranslateY.value }],
  }));

  return (
    <Animated.View
      accessibilityElementsHidden={!isVisible}
      importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={isVisible ? 'box-none' : 'none'}
      style={[
        {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          height: footerHeight,
        },
        footerAnimatedStyle,
      ]}
    >
      <LinearGradient
        colors={[`${BACKGROUND}00`, BACKGROUND]}
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: PREMIUM_FOOTER_FADE_HEIGHT,
        }}
      />
      <View
        pointerEvents="box-none"
        className="absolute bottom-0 left-0 right-0 items-center bg-[#0F0F10]"
        style={{ top: PREMIUM_FOOTER_FADE_HEIGHT }}
      >
        <Text
          className="mt-[11px] px-4 text-center text-white/70"
          onLayout={event => setSubtitleHeight(event.nativeEvent.layout.height)}
          style={{
            fontFamily: 'MonaSans_400Regular',
            fontSize: 16,
            lineHeight: 23,
          }}
        >
          {ctaSubtitle}
        </Text>
        <View className={`${SIDEBAR_BODY_WIDTH} px-[18px]`}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: !canUpgrade }}
            disabled={!canUpgrade}
            onPress={() => {
              if (canUpgrade) onUpgradePress(tier);
            }}
            className={`mt-[14px] h-[50px] items-center justify-center rounded-full ${canUpgrade ? 'bg-[#94F27F] active:opacity-80' : 'bg-white/10'}`}
          >
            <Text
              className={`font-semibold ${canUpgrade ? 'text-black' : 'text-white/70'}`}
              style={{
                fontFamily: 'MonaSans_600SemiBold',
                fontSize: 16,
                lineHeight: 23,
              }}
            >
              {label}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
};

export default function RewardsBenefitsScreenNew() {
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const { tier: requestedTier } = useLocalSearchParams<{ tier?: string }>();
  const initialTier = TIERS.find(tier => tier === requestedTier) ?? null;
  return (
    <RewardsBenefitsForAccount
      key={`${userId ?? 'none'}:${initialTier ?? 'current'}`}
      initialTier={initialTier}
    />
  );
}

function RewardsBenefitsForAccount({ initialTier }: { initialTier: RewardsTier | null }) {
  const {
    data: rewardsData,
    isError,
    isFetching: isRewardsFetching,
    refetch: refetchRewards,
  } = useRewardsUserData();
  const { data: tierBenefits } = useTierBenefits();
  const confirmed = useRewardsUpgradeStore(state => state.confirmed);
  const pending = useRewardsUpgradeStore(state => !!state.pendingUntil && state.savingsConfirmed);
  const timedOut = useRewardsUpgradeStore(state => state.timedOut);
  const currentTier = isError ? undefined : confirmed?.currentTier;
  const upgradeTarget = (tier: RewardsTier) =>
    rewardsData?.fuseSkipLine?.enabled
      ? rewardsData.fuseSkipLine.tiers.find(
          target => target.tier === tier && target.requiredFuse > 0,
        )
      : undefined;
  const { data: membership } = useTierMembership();
  const openTierUpgrade = useTierUpgradeStore(state => state.open);
  const [selectedTierOverride, setSelectedTierOverride] = useState<RewardsTier | null>(initialTier);
  const [isUpgradeSheetOpen, setIsUpgradeSheetOpen] = useState(false);
  const [upgradeTier, setUpgradeTier] = useState<RewardsTier.PRIME | RewardsTier.ULTRA>(
    RewardsTier.PRIME,
  );
  const selectedTier = selectedTierOverride ?? rewardsData?.currentTier ?? RewardsTier.CORE;
  const insets = useSafeAreaInsets();
  const isSidebarShell = useIsSidebarShell();
  // Keep the hero's spacing while letting its scrolling backdrop reach the web header.
  const heroTopInset =
    insets.top + (Platform.OS === 'web' && isSidebarShell ? SIDEBAR_BODY_TOP_GUTTER : 0);
  const { selectToken: selectSavingsFundToken } = useSavingsFundFlow();
  const openBuyFuse = useSwapState(state => state.actions.openBuyFuse);
  // The pager's pages are as wide as the column the page gets, which on desktop is
  // the body column beside the sidebar rather than the whole window.
  const pageWidth = usePageWidth();
  const selectorBlurTarget = useRef<View>(null);
  const reduceMotion = useReducedMotion();
  // Suspends the page's vertical ScrollView while a horizontal swipe is active,
  // so the two gestures (a plain RN ScrollView isn't gesture-handler-aware)
  // don't both react to the same touch and fight over the drag.
  const [isSwiping, setIsSwiping] = useState(false);

  // Pixel offset of the 3-wide pager row. -index * pageWidth is "at rest" on
  // that tier; onUpdate adds the live drag delta so real, already-rendered
  // neighboring pages follow the finger instead of faking a swipe with a
  // fade/slide of a single swapped-out content block.
  const translateX = useSharedValue(-TIERS.indexOf(selectedTier) * pageWidth);
  const pagerTargetX = useSharedValue(-TIERS.indexOf(selectedTier) * pageWidth);
  const dragOriginX = useSharedValue(-TIERS.indexOf(selectedTier) * pageWidth);
  const dragStartIndex = useSharedValue(TIERS.indexOf(selectedTier));
  const didRelease = useSharedValue(false);
  const isDragging = useSharedValue(false);

  useEffect(() => {
    if (isDragging.value) return;
    const index = TIERS.indexOf(selectedTier);
    const targetX = -index * pageWidth;
    // A gesture already started this snap on the UI thread. Committing its
    // selected tab must not restart the same animation on the next render.
    if (pagerTargetX.value === targetX && !reduceMotion) return;
    pagerTargetX.value = targetX;
    translateX.value = reduceMotion
      ? targetX
      : withTiming(targetX, { duration: SLIDE_DURATION, easing: SLIDE_EASING });
  }, [selectedTier, translateX, pagerTargetX, isDragging, pageWidth, reduceMotion]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  /**
   * The routes v3 is selling a tier by, or none.
   *
   * A tier the user already holds has no routes: the offer still carries its
   * price, and offering to sell it again would price an upgrade at nothing.
   */
  const upgradeRoutes = (tier: RewardsTier) => {
    const offer = findOffer(membership, tier);
    if (!membership?.enabled || !offer || offer.held) return [];
    return availableRoutes(offer);
  };

  const ctaFor = (tier: RewardsTier) => {
    const offer = findOffer(membership, tier);

    const cta = tierUpgradeCta({
      selectedTier: tier,
      currentTier,
      unavailable: !currentTier || isError,
      loadFailed: isError && !isRewardsFetching,
      pending,
      routes: upgradeRoutes(tier),
      annualFeeUsd: offer?.annualFeeUsd,
      lockFuse: offer?.lockFuse,
      remainingFuse: upgradeTarget(tier)?.remainingFuse,
      // The membership endpoint's own verdict, so a skew between it and the
      // rewards endpoint cannot leave an upgrade CTA on a tier the user has.
      offerHeld: offer?.held,
    });
    const offerCopy = membership?.enabled ? tierOfferSubtitle(offer) : null;
    return cta.enabled && !isError && !pending && upgradeRoutes(tier).length > 0 && offerCopy
      ? {
          ...cta,
          subtitle: offerCopy.includes('locked')
            ? offerCopy.replace(/^Requires /, 'Lock ').replace(' locked', ' to upgrade')
            : `${offerCopy} to upgrade`,
        }
      : cta;
  };

  /**
   * Whichever program is selling this tier gets the press.
   *
   * v3 first: it sells the tier outright, for a lock or an annual fee, and its
   * flow is the one that can take the money. v2's sheet only points at a
   * savings deposit, which under v3 unlocks nothing.
   */
  const handleUpgradePress = (tier: RewardsTier.PRIME | RewardsTier.ULTRA) => {
    if (isError) {
      void refetchRewards();
      return;
    }

    if (!ctaFor(tier).enabled) return;

    if (upgradeRoutes(tier).length > 0) {
      openTierUpgrade(tier);
      return;
    }

    setUpgradeTier(tier);
    setIsUpgradeSheetOpen(true);
  };
  const canUseUpgradeSheet =
    isHigherTier(upgradeTier, currentTier) && !pending && !!upgradeTarget(upgradeTier);
  useEffect(() => {
    if (!canUseUpgradeSheet) setIsUpgradeSheetOpen(false);
  }, [canUseUpgradeSheet]);

  const handleDepositFuse = useCallback(() => {
    if (!canUseUpgradeSheet) return;
    setIsUpgradeSheetOpen(false);

    const depositStore = useDepositStore.getState();
    depositStore.resetDepositFlow();
    depositStore.setSavingsFundIntent('savings');
    depositStore.setDepositFromSolid(false);
    selectSavingsFundToken('WFUSE');
  }, [selectSavingsFundToken, canUseUpgradeSheet]);

  const handleBuyFuse = useCallback(() => {
    if (!canUseUpgradeSheet) return;
    setIsUpgradeSheetOpen(false);
    openBuyFuse(upgradeTier);
  }, [openBuyFuse, upgradeTier, canUseUpgradeSheet]);

  // Top fade sits over the scrolled content so the header + tier switcher stay
  // legible as content passes under them; the matching bottom fade dims content
  // off the bottom edge now that the tab bar no longer occupies it.
  const overlays = (
    <>
      <LinearGradient
        colors={['#0F0F1080', '#0F0F1000']}
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + HEADER_TOP_SPACING + HEADER_ROW_HEIGHT + 30,
          zIndex: 10,
        }}
      >
        {/* Constrained to the page column so the back button lines up with the
            content rather than floating out at the edge of the desktop body. */}
        <View
          className={`relative flex-row items-center justify-center px-4 ${SIDEBAR_BODY_WIDTH}`}
          style={{ height: HEADER_ROW_HEIGHT, marginTop: insets.top + HEADER_TOP_SPACING }}
        >
          {/* Stretched top-to-bottom so it centres on the tabs beside it. */}
          <View
            className="absolute bottom-0 left-4 top-0 justify-center"
            style={{ transform: [{ scale: 0.88 }] }}
          >
            <BackButton variant="header" onPress={() => router.push(path.REWARDS)} />
          </View>
          <TierSwitcher
            tiers={TIERS}
            labels={TIER_LABELS}
            selected={selectedTier}
            onSelect={setSelectedTierOverride}
            appearance="light"
            progress={translateX}
            pageWidth={pageWidth}
            scale={Math.min(pageWidth / 420, 1)}
            blurTarget={selectorBlurTarget}
          />
        </View>
      </LinearGradient>

      <LinearGradient
        colors={[`${BACKGROUND}00`, BACKGROUND]}
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: insets.bottom + FADE_EXTENT,
        }}
      />
      {(currentTier || (isError && !isRewardsFetching)) && (
        <PremiumUpgradeFooter
          selectedTier={selectedTier}
          cta={ctaFor(selectedTier)}
          onUpgradePress={handleUpgradePress}
        />
      )}
      <UpgradeTierSheet
        open={isUpgradeSheetOpen && canUseUpgradeSheet}
        remainingFuse={upgradeTarget(upgradeTier)?.remainingFuse}
        tier={upgradeTier}
        onOpenChange={setIsUpgradeSheetOpen}
        onDepositFuse={handleDepositFuse}
        onBuyFuse={handleBuyFuse}
      />
    </>
  );

  // Only horizontal drags trigger a tier swap; vertical drags fall through to
  // the page's ScrollView untouched. onUpdate follows the finger in real time
  // (with rubber-banding past the first/last tier); onEnd either continues on
  // to the next/previous tier or snaps back to the current one.
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      'worklet';
      cancelAnimation(translateX);
      isDragging.value = true;
      didRelease.value = false;
      // Start exactly where the previous snap currently is, even if a second
      // swipe interrupts it before React has committed the selected tier.
      dragOriginX.value = translateX.value;
      dragStartIndex.value = Math.max(
        0,
        Math.min(TIERS.length - 1, Math.round(-translateX.value / pageWidth)),
      );
      scheduleOnRN(setIsSwiping, true);
    })
    .onUpdate(event => {
      'worklet';
      const nextX = dragOriginX.value + event.translationX;
      const minimumX = -(TIERS.length - 1) * pageWidth;
      translateX.value =
        nextX > 0
          ? nextX * RUBBER_BAND_FACTOR
          : nextX < minimumX
            ? minimumX + (nextX - minimumX) * RUBBER_BAND_FACTOR
            : nextX;
    })
    .onEnd(event => {
      'worklet';
      const index = dragStartIndex.value;
      const isSwipeLeft =
        event.translationX < -SWIPE_DISTANCE_THRESHOLD ||
        event.velocityX < -SWIPE_VELOCITY_THRESHOLD;
      const isSwipeRight =
        event.translationX > SWIPE_DISTANCE_THRESHOLD || event.velocityX > SWIPE_VELOCITY_THRESHOLD;

      let targetIndex = index;
      if (isSwipeLeft && index < TIERS.length - 1) targetIndex = index + 1;
      else if (isSwipeRight && index > 0) targetIndex = index - 1;

      didRelease.value = true;
      const targetX = -targetIndex * pageWidth;
      pagerTargetX.value = targetX;
      translateX.value = reduceMotion
        ? targetX
        : withTiming(targetX, { duration: SLIDE_DURATION, easing: SLIDE_EASING });
      scheduleOnRN(setSelectedTierOverride, TIERS[targetIndex]);
    })
    .onFinalize(() => {
      'worklet';
      // Native cancellation (for example another gesture taking ownership)
      // must not leave the pager stranded between two tiers.
      if (isDragging.value && !didRelease.value) {
        const targetX = -dragStartIndex.value * pageWidth;
        pagerTargetX.value = targetX;
        translateX.value = reduceMotion
          ? targetX
          : withTiming(targetX, { duration: SLIDE_DURATION, easing: SLIDE_EASING });
        scheduleOnRN(setSelectedTierOverride, TIERS[dragStartIndex.value]);
      }
      isDragging.value = false;
      scheduleOnRN(setIsSwiping, false);
    });

  return (
    <View style={{ flex: 1, backgroundColor: BACKGROUND, overflow: 'hidden' }}>
      <PageLayout
        className="bg-transparent"
        showNavbar={false}
        edges={['left', 'right']}
        additionalContent={overlays}
        scrollEnabled={!isSwiping}
        showsVerticalScrollIndicator={false}
        sidebarTopGutter={Platform.OS === 'web' ? 0 : undefined}
        blurTargetRef={selectorBlurTarget}
      >
        {timedOut && (
          <Text className="mt-28 px-5 text-center text-white/70">
            Savings refreshed. No higher tier has been confirmed yet. Check your FUSE Savings
            balance and tier requirement before adding more.
          </Text>
        )}
        <GestureDetector gesture={swipeGesture} touchAction="pan-y">
          {/* Desktop: the row is three columns wide, so clip the neighbouring tiers at
            the column's edge — on mobile they simply hang off-screen. */}
          <View style={{ width: pageWidth, overflow: 'hidden' }}>
            <TierBenefitsBackground position={translateX} width={pageWidth} topInset={insets.top} />
            <Animated.View style={[{ flexDirection: 'row' }, rowStyle]}>
              {TIERS.map(tier => (
                <TierBenefitsPage
                  key={tier}
                  tier={tier}
                  active={selectedTier === tier}
                  current={currentTier === tier}
                  width={pageWidth}
                  topInset={heroTopInset}
                  bottomInset={insets.bottom}
                  position={translateX}
                  benefits={tierBenefits?.find(benefit => benefit.tier === tier)}
                  allBenefits={tierBenefits}
                  fees={tierBenefits?.find(benefit => benefit.tier === tier)?.fees}
                  offer={membership?.enabled ? findOffer(membership, tier) : undefined}
                  showUpgradeSpace={
                    !ctaFor(tier).held &&
                    (tier !== RewardsTier.CORE || (isError && !isRewardsFetching))
                  }
                  subtitle={(() => {
                    const pointsEnabled = membership?.pointsUnlockEnabled ?? true;
                    const offerCopy = membership?.enabled
                      ? tierOfferSubtitle(findOffer(membership, tier))
                      : null;
                    const copy =
                      tier === RewardsTier.CORE
                        ? 'Starting tier'
                        : (offerCopy ??
                          (pointsEnabled
                            ? tier === RewardsTier.PRIME
                              ? 'Unlocks at 5M points'
                              : 'Unlocks at 35M points'
                            : null));
                    if (!copy) return null;
                    const text = (
                      <Text
                        style={{
                          fontFamily: 'MonaSans_400Regular',
                          fontSize: 16 * Math.min(pageWidth / 420, 1),
                          lineHeight: 20,
                          color: 'rgba(255,255,255,0.7)',
                        }}
                      >
                        {copy}
                      </Text>
                    );
                    return selectedTier === tier &&
                      pointsEnabled &&
                      !offerCopy &&
                      tier !== RewardsTier.CORE ? (
                      <TierPointsSheet
                        trigger={
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${copy}. Learn how to earn points`}
                            hitSlop={8}
                          >
                            {text}
                          </Pressable>
                        }
                      />
                    ) : (
                      text
                    );
                  })()}
                />
              ))}
            </Animated.View>
          </View>
        </GestureDetector>
      </PageLayout>
    </View>
  );
}
