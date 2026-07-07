import React, { useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import * as Application from 'expo-application';
import { Image } from 'expo-image';
import * as IntentLauncher from 'expo-intent-launcher';
import { Href, router } from 'expo-router';
import {
  Bell,
  ChevronRight,
  CircleDollarSign,
  HandCoins,
  Heart,
  Sparkles,
} from 'lucide-react-native';

import ProfileIcon from '@/assets/images/profile';
import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import ReferralProgramModal from '@/components/Referral/ReferralProgramModal';
import { SettingsCard } from '@/components/Settings';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getTierDisplayName, getTierIcon } from '@/constants/rewards';
import { useDimension } from '@/hooks/useDimension';
import useNotificationPermissionStatus from '@/hooks/useNotificationPermissionStatus';
import { useRewardsUserData } from '@/hooks/useRewards';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';
import { RewardsTier } from '@/lib/types';
import { cn, getUserDisplayName } from '@/lib/utils';

const AccountDetailsIcon = getAsset('images/settings_account_details.png');
const SecurityIcon = getAsset('images/settings_security.png');
const HelpSupportIcon = getAsset('images/settings_help_and_support.png');
const LogoutIcon = getAsset('images/settings_logout.png');

type MobileSettingsRow = {
  title: string;
  icon: React.ReactNode;
  href?: Href;
  onPress?: () => void;
  accessory?: React.ReactNode;
};

const mobileHeader = (
  <View className="px-4 pb-0 pt-1">
    <BackButton />
  </View>
);

const IconImage = ({
  source,
  width,
  height,
}: {
  source: ReturnType<typeof getAsset>;
  width: number;
  height: number;
}) => <Image source={source} contentFit="contain" style={{ width, height }} />;

const TierBadge = ({ tier }: { tier: RewardsTier }) => {
  return (
    <View className="h-[29px] flex-row items-center gap-1.5 rounded-full bg-[#FFD15126] px-3">
      <Text className="text-base font-semibold text-[#FFD151]">{getTierDisplayName(tier)}</Text>
      <Image source={getTierIcon(tier)} contentFit="contain" style={{ width: 19, height: 19 }} />
    </View>
  );
};

const SettingsRow = ({ title, icon, href, onPress, accessory }: MobileSettingsRow) => {
  const handlePress = () => {
    if (href) {
      router.push(href);
      return;
    }

    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      className="h-[60px] flex-row items-center justify-between px-5 active:opacity-70"
      accessibilityRole="button"
    >
      <View className="flex-1 flex-row items-center gap-3">
        <View className="w-6 items-center justify-center">{icon}</View>
        <Text className="text-[17px] font-bold text-white">{title}</Text>
      </View>
      <View className="flex-row items-center gap-4">
        {accessory}
        <ChevronRight size={22} color="#ffffff" strokeWidth={1.8} />
      </View>
    </Pressable>
  );
};

const SettingsRowGroup = ({ rows }: { rows: MobileSettingsRow[] }) => {
  return (
    <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
      {rows.map((row, index) => (
        <React.Fragment key={row.title}>
          <SettingsRow {...row} />
          {index < rows.length - 1 && <View className="h-px bg-[#101010]" />}
        </React.Fragment>
      ))}
    </View>
  );
};

const MobileSettings = () => {
  const { user, handleLogout } = useUser();
  const { data: rewardsData } = useRewardsUserData();
  const currentTier = rewardsData?.currentTier ?? RewardsTier.CORE;
  const displayName = getUserDisplayName(user, 18);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

  const rowGroups: MobileSettingsRow[][] = [
    [
      {
        title: 'Rewards',
        icon: <CircleDollarSign size={23} color="#ffffff" strokeWidth={2} />,
        href: path.REWARDS,
        accessory: <TierBadge tier={currentTier} />,
      },
      {
        title: 'Refer & Earn',
        icon: <Heart size={23} color="#ffffff" strokeWidth={2} />,
        onPress: () => setIsReferralModalOpen(true),
      },
    ],
    [
      {
        title: 'Account details',
        icon: <IconImage source={AccountDetailsIcon} width={22} height={22} />,
        href: '/settings/account' as Href,
      },
      {
        title: 'Security',
        icon: <IconImage source={SecurityIcon} width={24} height={24} />,
        href: '/settings/security' as Href,
      },
    ],
    [
      {
        title: 'Agent wallet',
        icon: <Sparkles size={24} color="#ffffff" strokeWidth={1.8} />,
        href: path.AGENT,
      },
      {
        title: 'GoodDollar',
        icon: <HandCoins size={24} color="#ffffff" strokeWidth={1.8} />,
        href: path.GOODDOLLAR,
      },
    ],
    [
      {
        title: 'Help & Support',
        icon: <IconImage source={HelpSupportIcon} width={24} height={24} />,
        href: '/settings/help' as Href,
      },
    ],
    [
      {
        title: 'Sign out',
        icon: <IconImage source={LogoutIcon} width={23} height={20} />,
        onPress: handleLogout,
      },
    ],
  ];

  return (
    <PageLayout customMobileHeader={mobileHeader} useDesktopBreakpoint>
      <View className="mx-auto w-full max-w-[512px] px-4 pb-10">
        <View className="items-center">
          <View className="relative h-[124px] w-[124px] items-center justify-center rounded-full bg-[#2A2A2A]">
            <ProfileIcon width={48} height={60} />
          </View>
          <Text className="mt-3 text-lg font-semibold text-white">{displayName}</Text>
        </View>

        <View className="mt-9 gap-2.5">
          {rowGroups.map((rows, index) => (
            <SettingsRowGroup key={index} rows={rows} />
          ))}
        </View>
      </View>
      <ReferralProgramModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
      />
    </PageLayout>
  );
};

const DesktopSettings = () => {
  const { handleLogout } = useUser();
  const { isDesktop } = useDimension();
  const { status: notificationStatus } = useNotificationPermissionStatus();

  const notificationStatusColor =
    notificationStatus === 'Authorized'
      ? 'text-[#94F27F]'
      : notificationStatus === 'Denied'
        ? 'text-[#FFB347]'
        : 'text-[#ACACAC]';

  const handleLegalPress = () => {
    const url =
      'https://support.solid.xyz/en/articles/13184959-legal-privacy-policy-terms-conditions#h_5cf45398ce';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const desktopHeader = (
    <>
      <Navbar />
      <View className="mx-auto w-full max-w-[512px] px-4 pb-8 pt-8">
        <View className="mb-8 flex-row items-center justify-between">
          <BackButton />
          <Text className="text-3xl font-semibold text-white">Settings</Text>
          <View className="w-6" />
        </View>
      </View>
    </>
  );

  return (
    <PageLayout customDesktopHeader={desktopHeader} useDesktopBreakpoint>
      <View
        className={cn('mx-auto w-full gap-3 px-4 py-4', {
          'max-w-[512px]': isDesktop,
          'max-w-7xl': !isDesktop,
        })}
      >
        <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
          <SettingsCard
            title="Account details"
            icon={<IconImage source={AccountDetailsIcon} width={22} height={22} />}
            link="/settings/account"
            isDesktop={isDesktop}
            hideIconBackground
          />
        </View>

        <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
          <SettingsCard
            title="Security"
            icon={<IconImage source={SecurityIcon} width={24} height={24} />}
            link="/settings/security"
            isDesktop={isDesktop}
            hideIconBackground
          />
        </View>

        {Platform.OS !== 'web' && (
          <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
            <SettingsCard
              title="Push Notifications"
              description={notificationStatus}
              descriptionStyle={notificationStatusColor}
              icon={<Bell size={22} color="#ffffff" />}
              onPress={() => {
                if (Platform.OS === 'android') {
                  IntentLauncher.startActivityAsync(
                    IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS,
                    { extra: { 'android.provider.extra.APP_PACKAGE': Application.applicationId } },
                  );
                } else {
                  Linking.openSettings();
                }
              }}
              isDesktop={isDesktop}
              hideIconBackground
            />
          </View>
        )}

        <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
          <SettingsCard
            title="Help & Support"
            icon={<IconImage source={HelpSupportIcon} width={24} height={24} />}
            link="/settings/help"
            isDesktop={isDesktop}
            hideIconBackground
          />
        </View>

        <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
          <SettingsCard
            title="Logout"
            icon={<IconImage source={LogoutIcon} width={23} height={20} />}
            onPress={handleLogout}
            isDesktop={isDesktop}
            hideIconBackground
          />
        </View>

        <View className="items-center pb-4 pt-6">
          <Pressable onPress={handleLegalPress} className="active:opacity-70">
            <Text className="text-base font-medium text-[#808080]">Legal</Text>
          </Pressable>
        </View>

        {Platform.OS !== 'web' && (
          <View className="items-center px-4 pb-2">
            <Text className="text-xs text-muted-foreground">
              {Application.applicationName || 'Solid'} v
              {Application.nativeApplicationVersion || 'Unknown'} - Build{' '}
              {Application.nativeBuildVersion || 'Unknown'}
            </Text>
          </View>
        )}
      </View>
    </PageLayout>
  );
};

export default function Settings() {
  const { isDesktop } = useDimension();

  if (isDesktop) {
    return <DesktopSettings />;
  }

  return <MobileSettings />;
}
