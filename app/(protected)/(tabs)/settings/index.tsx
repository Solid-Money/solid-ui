import React, { useCallback, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import * as Application from 'expo-application';
import { Href, router, useFocusEffect } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import ProfileAvatar from '@/components/Profile/ProfileAvatar';
import ProfileHubIcon from '@/components/Profile/ProfileHubIcon';
import { ProfileRow, ProfileRowGroup } from '@/components/Profile/ProfileRow';
import TierMembershipSheet from '@/components/Rewards/NewRewards/TierMembershipSheet';
import TrustpilotReviewCard from '@/components/Trustpilot/TrustpilotReviewCard';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getTierDisplayName } from '@/constants/rewards';
import { useHasFeature } from '@/hooks/useFeatureAccess';
import useNotificationPermissionStatus from '@/hooks/useNotificationPermissionStatus';
import { useReferralSummary, useRewardsUserData } from '@/hooks/useRewards';
import { useTotp } from '@/hooks/useTotp';
import useUser from '@/hooks/useUser';
import { openHelpLink } from '@/lib/help/links';
import { RewardsTier } from '@/lib/types';
import { formatWholeDollars, getUserDisplayName } from '@/lib/utils';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

const LEGAL_URL =
  'https://support.solid.xyz/en/articles/13184959-legal-privacy-policy-terms-conditions#h_5cf45398ce';

const mobileHeader = (
  <View className="mx-auto w-full max-w-[512px] px-4 pb-6 pt-[15px]">
    <BackButton
      variant="header"
      fallbackHref={path.HOME}
      className="my-0"
      icon={<ProfileHubIcon name="arrow-left" />}
    />
  </View>
);

// In the app's help center when it can; the website otherwise.
const openLegal = () => openHelpLink(LEGAL_URL);

/**
 * Settings hub: editable identity above compact membership, account, security
 * and support groups. Status chips reflect the account's current state.
 */
export default function Settings() {
  const { user, handleLogout } = useUser();
  const [isMembershipSheetOpen, setIsMembershipSheetOpen] = useState(false);

  const { data: rewardsData } = useRewardsUserData();
  const { data: referralSummary } = useReferralSummary();
  const { isVerified: isTotpOn, isLoading: isTotpLoading, refetch: refetchTotp } = useTotp();
  const { status: notificationStatus } = useNotificationPermissionStatus();
  const hasStatements = useHasFeature('statements');

  // Setting up 2FA happens a screen away, so "Add 2FA" is re-checked on the way back.
  useFocusEffect(
    useCallback(() => {
      void refetchTotp();
    }, [refetchTotp]),
  );

  const displayName = getUserDisplayName(user, 18);
  const currentTier = rewardsData?.currentTier ?? RewardsTier.CORE;
  const referrerUsd = referralSummary?.rewards.referrerUsd;

  return (
    <PageLayout
      customMobileHeader={mobileHeader}
      useDesktopBreakpoint
      className="bg-[#111111]"
      contentClassName="bg-[#111111]"
    >
      <View className="mx-auto w-full max-w-[512px] gap-6 px-4 pb-10">
        <View className="min-h-[156px] items-center">
          <Pressable
            onPress={() => router.push('/settings/account' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Edit account details"
            className="active:opacity-80"
          >
            <ProfileAvatar name={displayName} size={88} variant="hub" />
            <View className="absolute -bottom-px -right-px h-7 w-7 items-center justify-center rounded-full border-[3px] border-[#111111] bg-[#F2F2F2]">
              <ProfileHubIcon name="pencil" size={14} />
            </View>
          </Pressable>

          <Text
            className="mt-[14px] max-w-full text-[22px] font-semibold leading-[27px] text-white"
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {user?.email ? (
            <Text
              className="mt-0.5 max-w-full text-[15px] leading-[18px] text-[#ACACAC]"
              numberOfLines={1}
            >
              {user.email}
            </Text>
          ) : null}
        </View>

        <ProfileRowGroup variant="hub">
          <ProfileRow
            variant="hub"
            icon={<ProfileHubIcon name="badge-check" />}
            title="Membership"
            value={getTierDisplayName(currentTier)}
            valueIcon={<ProfileHubIcon name="sparkle" size={14} />}
            onPress={() => setIsMembershipSheetOpen(true)}
          />
          <ProfileRow
            variant="hub"
            icon={<ProfileHubIcon name="users-round" />}
            title={referrerUsd ? `Refer & earn ${formatWholeDollars(referrerUsd)}` : 'Refer & earn'}
            onPress={() => router.push(path.REFERRAL_PROGRAM)}
          />
        </ProfileRowGroup>

        <ProfileRowGroup variant="hub">
          <ProfileRow
            variant="hub"
            icon={<ProfileHubIcon name="user-round" />}
            title="Account details"
            onPress={() => router.push('/settings/account' as Href)}
          />
          {hasStatements ? (
            <ProfileRow
              variant="hub"
              icon={<ProfileHubIcon name="file-down" />}
              title="Statements"
              onPress={() => router.push('/settings/statements' as Href)}
            />
          ) : null}
          <ProfileRow
            variant="hub"
            icon={<ProfileHubIcon name="shield-check" />}
            title="Security"
            value={!isTotpLoading && !isTotpOn ? 'Add 2FA' : undefined}
            valueTone="warning"
            onPress={() => router.push('/settings/security' as Href)}
          />
          {/* Push only exists in the apps; the web has nothing to switch on. */}
          {Platform.OS !== 'web' ? (
            <ProfileRow
              variant="hub"
              icon={<ProfileHubIcon name="bell" />}
              title="Notifications"
              value={notificationStatus === 'Authorized' ? 'On' : 'Off'}
              onPress={() => router.push('/settings/notifications' as Href)}
            />
          ) : null}
        </ProfileRowGroup>

        <ProfileRowGroup variant="hub">
          <ProfileRow
            variant="hub"
            icon={<ProfileHubIcon name="life-buoy" />}
            title="Help & support"
            onPress={() => openSupportDrawer()}
          />
          <ProfileRow
            variant="hub"
            icon={<ProfileHubIcon name="file-text" />}
            title="Legal & privacy"
            onPress={openLegal}
          />
        </ProfileRowGroup>

        {/* Web/desktop only — native asks for a rating through the OS sheet. */}
        <TrustpilotReviewCard analyticsContext="settings" />

        <Pressable
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          className="min-h-[67px] flex-row items-center justify-center gap-2 rounded-[20px] bg-[#1C1C1C] py-[22px] active:opacity-70 web:hover:bg-[#242424]"
        >
          <ProfileHubIcon name="log-out" />
          <Text className="text-[16px] font-semibold leading-[23px] text-[#F27F81]">Sign out</Text>
        </Pressable>

        {Platform.OS !== 'web' ? (
          <Text className="text-center text-[13px] leading-[16px] text-white/35">
            {Application.applicationName || 'Solid'} v
            {Application.nativeApplicationVersion || 'Unknown'} · Build{' '}
            {Application.nativeBuildVersion || 'Unknown'}
          </Text>
        ) : null}
      </View>
      <TierMembershipSheet open={isMembershipSheetOpen} onOpenChange={setIsMembershipSheetOpen} />
    </PageLayout>
  );
}
