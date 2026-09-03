import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import Loading from '@/components/Loading';
import HeaderHelpButton from '@/components/Navbar/HeaderHelpButton';
import PageLayout from '@/components/PageLayout';
import ReferralProgramModalNew from '@/components/Referral/ReferralProgramModalNew';
import RewardsWelcomePopup from '@/components/Rewards/RewardsWelcomePopup';
import { Text } from '@/components/ui/text';
import { SPIN_WIN_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { SPIN_WIN } from '@/constants/spinWinDesign';
import { cardDetailsQueryOptions } from '@/hooks/cardDetailsQueryOptions';
import { useOptInToRewards, useReferralSummary, useRewardsUserData } from '@/hooks/useRewards';
import { useSpinStatus } from '@/hooks/useSpinWin';
import { monthlyCashbackTotal } from '@/lib/cashbackProgress';
import { IS_TIER_CASHBACK_HARDCODED, isDevFeatureEnabled } from '@/lib/config';
import { resolveTierCashbackRate } from '@/lib/tierCashback';
import { RewardsTier } from '@/lib/types';
import { useRewardsIntroStore } from '@/store/useRewardsIntroStore';
import { useRewardsWelcomePopupStore } from '@/store/useRewardsWelcomePopupStore';
import { useSpinWinModalStore } from '@/store/useSpinWinModalStore';
import { useUserStore } from '@/store/useUserStore';

import PointsHeadline from './PointsHeadline';
import RewardsHelpModal from './RewardsHelpModal';
import RewardsSummaryCard from './RewardsSummaryCard';
import { hasSkipTheLine } from './skipTheLine';
import SkipTheLineSection from './SkipTheLineSection';
import { resolveTierBenefitRates } from './tierBenefitCards';
import TierBenefitsGrid from './TierBenefitsGrid';

/**
 * Redesigned rewards screen (Apple "glass" style), shown only on qa/preview
 * builds via the dispatcher in rewards/index.tsx. Production and all
 * desktop-web users keep the legacy rewards screen.
 *
 * Shows the user's CURRENT tier + points, a rewards summary (cashback +
 * referrals), and the current tier's daily benefits. "Invite friends" opens the
 * referral program popup; "Explore tiers" opens the rewards benefits screen
 * (full tier comparison).
 */
export default function RewardsScreenNew() {
  const isFocused = useIsFocused();
  const selectedUserId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const { data: rewardsData, isLoading } = useRewardsUserData();
  const { data: referralSummary } = useReferralSummary();
  const { data: cardDetails } = useQuery(cardDetailsQueryOptions(selectedUserId));
  const { data: spinStatus } = useSpinStatus();
  const openSpinWinModal = useSpinWinModalStore(state => state.setModal);
  const { mutate: joinRewards, isPending: isJoining } = useOptInToRewards();
  const hasCompletedIntro = useRewardsIntroStore(
    state => !selectedUserId || Boolean(state.completedByUserId[selectedUserId]),
  );
  const completeIntro = useRewardsIntroStore(state => state.complete);
  const welcomeDismissed = useRewardsWelcomePopupStore(state => state.dismissed);
  const setWelcomeDismissed = useRewardsWelcomePopupStore(state => state.setDismissed);

  const { referral: referralParam } = useLocalSearchParams<{ referral?: string }>();
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // The rewards program requires an explicit opt-in; `hasOptedIn` defaults to
  // true when the backend doesn't send it, so we never prompt prematurely.
  const hasOptedIn = rewardsData?.hasOptedIn ?? true;
  const rewardsLocked = Boolean(rewardsData && !hasOptedIn);
  const legacyPoints = rewardsData?.legacyPoints ?? 0;
  const showRewardsIntro = isFocused && rewardsLocked && !hasCompletedIntro;
  const showWelcomePopup = isFocused && rewardsLocked && hasCompletedIntro && !welcomeDismissed;

  useEffect(() => {
    if (isFocused && rewardsLocked && hasCompletedIntro && welcomeDismissed) {
      router.replace(path.HOME);
    }
  }, [hasCompletedIntro, isFocused, rewardsLocked, welcomeDismissed]);

  // Support the `/rewards?referral=open` deep link (e.g. settings "Refer & Earn").
  useEffect(() => {
    if (referralParam === 'open') {
      setIsReferralModalOpen(true);
      router.setParams({ referral: undefined });
    }
  }, [referralParam]);

  if (isLoading) {
    return (
      <PageLayout
        scrollable={false}
        mobileTitle={null}
        mobileHeaderRightAction="help"
        onMobileHeaderHelpPress={() => setIsHelpOpen(true)}
        desktopHeaderRightAction={
          <HeaderHelpButton
            accessibilityLabel="How rewards work"
            onPress={() => setIsHelpOpen(true)}
          />
        }
        additionalContent={
          <RewardsHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        }
      >
        <Loading />
      </PageLayout>
    );
  }

  // Rewards data failed to load (or the user has none yet) — render the full
  // page with Core-tier defaults and zeroed stats rather than an error state.
  const currentTier = rewardsData?.currentTier ?? RewardsTier.CORE;
  const totalPoints = rewardsData?.totalPoints ?? 0;

  if (rewardsLocked) {
    return (
      <PageLayout isLoading={welcomeDismissed}>
        <RewardsHelpModal
          isOpen={showRewardsIntro}
          onClose={() => router.replace(path.HOME)}
          onComplete={() => {
            if (selectedUserId) {
              setWelcomeDismissed(false);
              completeIntro(selectedUserId);
            }
          }}
        />
        <RewardsWelcomePopup
          isOpen={showWelcomePopup}
          variant={legacyPoints > 0 ? 'existing' : 'new'}
          oldPoints={legacyPoints}
          legacyCarryoverPoints={rewardsData?.legacyCarryoverPoints ?? 0}
          startingTier={rewardsData?.startingTier ?? currentTier}
          isJoining={isJoining}
          onAgree={() => joinRewards()}
          onClose={() => {
            setWelcomeDismissed(true);
            router.replace(path.HOME);
          }}
        />
      </PageLayout>
    );
  }

  const cashbackSettled = rewardsData?.cashbackThisMonth ?? 0;
  const cashbackPending = rewardsData?.cashbackPendingThisMonth;
  // One figure, settled and escrowed together — see `monthlyCashbackTotal`.
  const cashback = monthlyCashbackTotal(cashbackSettled, cashbackPending);
  const referrals = referralSummary?.totalRewardedUsd ?? 0;
  // All-time counts only what has actually been paid, so this month's escrowed
  // part is deliberately not floored into it.
  const allTimeCashback = Math.max(cardDetails?.cashback?.totalUsdValue ?? 0, cashbackSettled);
  // Both the benefit card's "N% Cashback" title and the cashback sheet's "Your
  // cashback rate" row read this, so they can't disagree with each other.
  const cashbackRate = resolveTierCashbackRate(
    currentTier,
    rewardsData?.cashbackRate,
    IS_TIER_CASHBACK_HARDCODED,
  );

  // Core grants neither the yield boost nor subscription cashback, so on a
  // Core test account both cards correctly disappear — which leaves nothing to
  // review. Off production, preview them at stock Prime rates instead.
  const benefitRates = resolveTierBenefitRates(
    {
      yieldBoostPercentage: rewardsData?.yieldBoostPercentage ?? 0,
      yieldBoostCap: rewardsData?.yieldBoostCap ?? 0,
      yieldBoostEarned: rewardsData?.yieldBoostEarned ?? 0,
      subscriptionDiscountRate: rewardsData?.subscriptionDiscountRate ?? 0,
    },
    isDevFeatureEnabled,
  );

  return (
    <PageLayout
      mobileTitle={null}
      mobileHeaderRightAction="help"
      onMobileHeaderHelpPress={() => setIsHelpOpen(true)}
      desktopHeaderRightAction={
        <HeaderHelpButton
          accessibilityLabel="How rewards work"
          onPress={() => setIsHelpOpen(true)}
        />
      }
      additionalContent={
        <RewardsHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      }
    >
      <View className="mb-5 w-full pb-24">
        <View className="mb-5 gap-5">
          <PointsHeadline tier={currentTier} points={totalPoints} />
          <View className="flex-row gap-3 px-4">
            <Pressable
              onPress={() => setIsReferralModalOpen(true)}
              className="h-14 flex-1 items-center justify-center rounded-full bg-white transition-all active:scale-95 active:opacity-80"
            >
              <Text className="text-base font-bold text-black">Invite friends</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(path.REWARDS_BENEFITS)}
              className="h-14 flex-1 items-center justify-center rounded-full bg-[#1C1C1C] transition-all active:scale-95 active:opacity-80"
            >
              <Text className="text-base font-semibold text-white">Explore tiers</Text>
            </Pressable>
          </View>

          {/* The spin & win flow is a native-only modal — SpinWinModalProvider
              force-closes itself on web — so the button stays native-only. It is
              deliberately NOT gated on `spinStatus.isAllowed`: the provider
              already closes itself when the backend says the user isn't
              eligible, and gating here made the button vanish silently whenever
              the status request hadn't resolved or failed. */}
          {Platform.OS !== 'web' && spinStatus?.isAllowed && (
            <View className="px-4">
              <Pressable
                onPress={() => openSpinWinModal(SPIN_WIN_MODAL.OPEN_HOME)}
                style={{ backgroundColor: SPIN_WIN.colors.goldSubtle }}
                className="h-14 items-center justify-center rounded-full transition-all active:scale-95 active:opacity-80"
              >
                <Text className="text-base font-bold" style={{ color: SPIN_WIN.colors.gold }}>
                  {spinStatus?.spinAvailableToday === false ? 'Spin & Win' : 'Spin the wheel'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <RewardsSummaryCard cashback={cashback} referrals={referrals} />

        <View className="mt-8">
          <TierBenefitsGrid
            cashbackRate={cashbackRate}
            // The settled and escrowed halves go down separately: the sheet
            // sums them itself, so handing it `cashback` would count the
            // escrowed part twice.
            cashbackThisMonth={cashbackSettled}
            cashbackPendingThisMonth={cashbackPending}
            maxCashbackMonthly={rewardsData?.maxCashbackMonthly ?? 0}
            allTimeCashback={allTimeCashback}
            {...benefitRates}
            onGetMoreCashback={() => router.push(path.REWARDS_BENEFITS)}
            onReferralsPress={() => setIsReferralModalOpen(true)}
          />
        </View>

        {/* Sits below the earned benefits: this is the shortcut past them.
            Renders nothing unless the backend says the mechanic is live. */}
        {hasSkipTheLine(rewardsData?.fuseSkipLine) && (
          <View className="mt-8">
            <SkipTheLineSection
              skipLine={rewardsData?.fuseSkipLine}
              onAddFuse={() => router.push(path.SAVINGS_FUSE)}
            />
          </View>
        )}
      </View>

      <ReferralProgramModalNew
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
      />
    </PageLayout>
  );
}
