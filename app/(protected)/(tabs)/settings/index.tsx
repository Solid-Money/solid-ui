import React, { ReactNode, useCallback, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import * as Application from 'expo-application';
import { Href, router, useFocusEffect } from 'expo-router';
import {
  Bell,
  ChevronRight,
  CircleCheck,
  CreditCard,
  FileText,
  LifeBuoy,
  LogOut,
  Pencil,
  ShieldCheck,
  Sparkle,
  Star,
  UserRound,
  UsersRound,
} from 'lucide-react-native';

import { SPEND_MODE_COPY } from '@/components/Card/NewCardDetails/SpendMode/spendModes';
import WhatsNewButton from '@/components/Navbar/WhatsNewButton';
import PageLayout from '@/components/PageLayout';
import EditAvatarSheet from '@/components/Profile/EditAvatarSheet';
import ProfileAvatar from '@/components/Profile/ProfileAvatar';
import { ProfileRow, ProfileRowGroup, ProfileSectionLabel } from '@/components/Profile/ProfileRow';
import TrustpilotReviewCard from '@/components/Trustpilot/TrustpilotReviewCard';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getTierDisplayName } from '@/constants/rewards';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';
import { useCardStatus } from '@/hooks/useCardStatus';
import useNotificationPermissionStatus from '@/hooks/useNotificationPermissionStatus';
import { useReferralSummary, useRewardsUserData } from '@/hooks/useRewards';
import { useTotp } from '@/hooks/useTotp';
import useUser from '@/hooks/useUser';
import { KycStatus, RewardsTier } from '@/lib/types';
import {
  formatWholeDollars,
  getUserDisplayName,
  hasCard,
  hasCardStatusWithRainApplication,
  hasPendingCard,
} from '@/lib/utils';
import { isKycAwaitingDecision } from '@/lib/utils/kyc/verificationProgress';
import { useProfileAvatarColorId } from '@/store/useProfileAvatarStore';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

const LEGAL_URL =
  'https://support.solid.xyz/en/articles/13184959-legal-privacy-policy-terms-conditions#h_5cf45398ce';

const ICON_SIZE = 18;
const ICON_COLOR = '#FFFFFF';

const formatPoints = (points: number) =>
  new Intl.NumberFormat('en-us', { notation: 'compact', maximumFractionDigits: 1 }).format(points);

const mobileHeader = (
  <View className="flex-row items-center justify-between p-4">
    <BackButton variant="header" fallbackHref={path.HOME} />
    <WhatsNewButton />
  </View>
);

const openLegal = () => {
  if (Platform.OS === 'web') {
    window.open(LEGAL_URL, '_blank');
  } else {
    void Linking.openURL(LEGAL_URL);
  }
};

/** One of the two tiles under the profile: Rewards and Refer & earn. */
const ProfileTile = ({
  icon,
  title,
  subtitle,
  subtitleClassName = 'text-[#8E8E8E]',
  onPress,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  subtitleClassName?: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={title}
    className="flex-1 rounded-2xl bg-[#1C1C1C] p-4 active:opacity-70 web:hover:bg-[#242424]"
  >
    <View className="flex-row items-center justify-between">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#2A2A2A]">{icon}</View>
      <ChevronRight size={18} color="#8E8E8E" />
    </View>
    <Text className="mt-6 text-base font-semibold text-white">{title}</Text>
    <Text className={`mt-0.5 text-sm ${subtitleClassName}`} numberOfLines={1}>
      {subtitle ?? ' '}
    </Text>
  </Pressable>
);

/**
 * Settings → Profile (Figma "Profile").
 *
 * Who you are at the top — avatar, name, tier and verification — then the two
 * things worth coming back for (rewards, referrals), and the account, security
 * and support rows below. Statements are not in this release.
 */
export default function Settings() {
  const { user, handleLogout } = useUser();
  const [isAvatarSheetOpen, setIsAvatarSheetOpen] = useState(false);
  const avatarColorId = useProfileAvatarColorId(user?.userId);

  const { data: rewardsData } = useRewardsUserData();
  const { data: referralSummary } = useReferralSummary();
  const { data: cardStatus } = useCardStatus();
  const { canChangeMode, mode } = useCardSpendRegistration();
  const { isVerified: isTotpOn, isLoading: isTotpLoading, refetch: refetchTotp } = useTotp();
  const { status: notificationStatus } = useNotificationPermissionStatus();

  // Setting up 2FA happens a screen away, so "Add 2FA" is re-checked on the way back.
  useFocusEffect(
    useCallback(() => {
      void refetchTotp();
    }, [refetchTotp]),
  );

  const displayName = getUserDisplayName(user, 18);
  const currentTier = rewardsData?.currentTier ?? RewardsTier.CORE;
  const isVerified = cardStatus?.kycStatus === KycStatus.APPROVED;
  const userHasCard = hasCard(cardStatus);
  const referrerUsd = referralSummary?.rewards.referrerUsd;

  // The card row names its destination rather than going through the `/card`
  // shim, which is kept only for old links.
  const cardHref: Href = userHasCard
    ? path.CARD_INFO
    : hasPendingCard(cardStatus) ||
        isKycAwaitingDecision(cardStatus) ||
        hasCardStatusWithRainApplication(cardStatus)
      ? path.CARD_ACTIVATE
      : path.CARD_COUNTRY_SELECTION;

  return (
    <PageLayout
      customMobileHeader={mobileHeader}
      useDesktopBreakpoint
      className="bg-[#111111]"
      contentClassName="bg-[#111111]"
      additionalContent={
        <EditAvatarSheet
          isOpen={isAvatarSheetOpen}
          onOpenChange={setIsAvatarSheetOpen}
          userId={user?.userId}
          name={displayName}
        />
      }
    >
      <View className="mx-auto w-full max-w-[512px] px-4 pb-10">
        <View className="items-center">
          <Pressable
            onPress={() => setIsAvatarSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Edit avatar"
            className="active:opacity-80"
          >
            <ProfileAvatar name={displayName} colorId={avatarColorId} size={84} />
            <View className="absolute -bottom-0.5 -right-0.5 h-8 w-8 items-center justify-center rounded-full border-[3px] border-[#111111] bg-[#2A2A2A]">
              <Pencil size={13} color={ICON_COLOR} />
            </View>
          </Pressable>

          <Text className="mt-4 text-xl font-semibold text-white">{displayName}</Text>
          {user?.email ? (
            <Text className="mt-0.5 text-sm text-[#8E8E8E]" numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}

          <View className="mt-4 flex-row flex-wrap items-center justify-center gap-2">
            <Pressable
              onPress={() => router.push(path.REWARDS)}
              accessibilityRole="button"
              className="h-8 flex-row items-center gap-1.5 rounded-full bg-[#1C1C1C] pl-3 pr-2 active:opacity-70"
            >
              <Sparkle size={14} color="#CFCFCF" />
              <Text className="text-sm font-medium text-[#CFCFCF]">
                {getTierDisplayName(currentTier)} member
              </Text>
              <ChevronRight size={14} color="#8E8E8E" />
            </Pressable>
            {isVerified ? (
              <View className="h-8 flex-row items-center gap-1.5 rounded-full bg-[#94F27F]/15 px-3">
                <CircleCheck size={14} color="#94F27F" />
                <Text className="text-sm font-medium text-[#94F27F]">Verified</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="mt-6 flex-row gap-3">
          <ProfileTile
            icon={<Star size={ICON_SIZE} color={ICON_COLOR} />}
            title="Rewards"
            subtitle={
              rewardsData ? `${formatPoints(rewardsData.totalPoints ?? 0)} points` : undefined
            }
            onPress={() => router.push(path.REWARDS)}
          />
          <ProfileTile
            icon={<UsersRound size={ICON_SIZE} color={ICON_COLOR} />}
            title="Refer & earn"
            subtitle={
              referrerUsd ? `Get ${formatWholeDollars(referrerUsd)} per friend` : 'Invite friends'
            }
            subtitleClassName="text-[#94F27F]"
            onPress={() => router.push(path.REFERRAL_PROGRAM)}
          />
        </View>

        <ProfileSectionLabel>Account</ProfileSectionLabel>
        <ProfileRowGroup>
          <ProfileRow
            icon={<UserRound size={ICON_SIZE} color={ICON_COLOR} />}
            title="Account details"
            onPress={() => router.push('/settings/account' as Href)}
          />
          <ProfileRow
            icon={<CreditCard size={ICON_SIZE} color={ICON_COLOR} />}
            title="Card"
            value={userHasCard && canChangeMode ? `${SPEND_MODE_COPY[mode].label} mode` : undefined}
            onPress={() => router.push(cardHref)}
          />
        </ProfileRowGroup>

        <ProfileSectionLabel>Security & alerts</ProfileSectionLabel>
        <ProfileRowGroup>
          <ProfileRow
            icon={<ShieldCheck size={ICON_SIZE} color={ICON_COLOR} />}
            title="Security"
            value={!isTotpLoading && !isTotpOn ? 'Add 2FA' : undefined}
            valueTone="warning"
            onPress={() => router.push('/settings/security' as Href)}
          />
          {/* Push only exists in the apps; the web has nothing to switch on. */}
          {Platform.OS !== 'web' ? (
            <ProfileRow
              icon={<Bell size={ICON_SIZE} color={ICON_COLOR} />}
              title="Notifications"
              value={notificationStatus === 'Authorized' ? 'On' : 'Off'}
              onPress={() => router.push('/settings/notifications' as Href)}
            />
          ) : null}
        </ProfileRowGroup>

        <ProfileSectionLabel>Support</ProfileSectionLabel>
        <ProfileRowGroup>
          <ProfileRow
            icon={<LifeBuoy size={ICON_SIZE} color={ICON_COLOR} />}
            title="Help & support"
            onPress={() => openSupportDrawer()}
          />
          <ProfileRow
            icon={<FileText size={ICON_SIZE} color={ICON_COLOR} />}
            title="Legal & privacy"
            onPress={openLegal}
          />
        </ProfileRowGroup>

        {/* Web/desktop only — native asks for a rating through the OS sheet. */}
        <TrustpilotReviewCard analyticsContext="settings" className="mt-6" />

        <Pressable
          onPress={handleLogout}
          accessibilityRole="button"
          className="mt-6 h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-[#1C1C1C] active:opacity-70 web:hover:bg-[#242424]"
        >
          <LogOut size={18} color="#FF7D7D" />
          <Text className="text-base font-semibold text-[#FF7D7D]">Sign out</Text>
        </Pressable>

        {Platform.OS !== 'web' ? (
          <Text className="mt-6 text-center text-xs text-[#6E6E6E]">
            {Application.applicationName || 'Solid'} v
            {Application.nativeApplicationVersion || 'Unknown'} · Build{' '}
            {Application.nativeBuildVersion || 'Unknown'}
          </Text>
        ) : null}
      </View>
    </PageLayout>
  );
}
