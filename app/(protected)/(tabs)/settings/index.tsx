import React from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Application from 'expo-application';
import { Image } from 'expo-image';
import * as IntentLauncher from 'expo-intent-launcher';
import { Href, router } from 'expo-router';
import { Bell, UsersRound } from 'lucide-react-native';

import Navbar from '@/components/Navbar';
import WhatsNewButton from '@/components/Navbar/WhatsNewButton';
import PageLayout from '@/components/PageLayout';
import { SettingsCard } from '@/components/Settings';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getTierDisplayName } from '@/constants/rewards';
import { useDimension } from '@/hooks/useDimension';
import useNotificationPermissionStatus from '@/hooks/useNotificationPermissionStatus';
import { useRewardsUserData } from '@/hooks/useRewards';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';
import { RewardsTier } from '@/lib/types';
import { cn, getUserDisplayName } from '@/lib/utils';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

const AccountDetailsIcon = getAsset('images/settings_account_details.png');
const SecurityIcon = getAsset('images/settings_security.png');
const HelpSupportIcon = getAsset('images/settings_help_and_support.png');
const LogoutIcon = getAsset('images/settings_logout.png');

type MobileSettingsRow = {
  title: string;
  icon: React.ReactNode;
  href?: Href;
  onPress?: () => void;
  /** Right-aligned status text, e.g. the notification permission state. */
  description?: string;
  descriptionClassName?: string;
};

const mobileHeader = (
  <View className="flex-row items-center justify-between p-4">
    <BackButton variant="header" fallbackHref={path.HOME} />
    <WhatsNewButton />
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

const ProfileAvatarIcon = () => (
  <Svg width={43} height={58} viewBox="0 0 42.2238 57.5006" fill="none">
    <Path
      d="M21.1146 23.1499C26.7373 23.1499 31.2955 18.1355 31.2955 11.9499C31.2955 5.76438 26.7373 0.75 21.1146 0.75C15.4918 0.75 10.9336 5.76438 10.9336 11.9499C10.9336 18.1355 15.4918 23.1499 21.1146 23.1499Z"
      stroke="white"
      strokeWidth={1.5}
    />
    <Path
      d="M41.4737 44.1507C41.4737 51.1095 41.4737 56.7506 21.1119 56.7506C0.75003 56.7506 0.75003 51.1095 0.75003 44.1507C0.75003 37.1919 9.86634 31.5508 21.1119 31.5508C32.3575 31.5508 41.4737 37.1919 41.4737 44.1507Z"
      stroke="white"
      strokeWidth={1.5}
    />
  </Svg>
);

const RewardsIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 19.8333 19.8333" fill="none">
    <Path
      d="M13.1962 2.01681L15.0296 2.97889C17.002 4.01394 17.9881 4.53146 18.5357 5.46143C19.0833 6.3914 19.0833 7.54861 19.0833 9.86304V9.97029C19.0833 12.2847 19.0833 13.442 18.5357 14.3719C17.9881 15.3019 17.002 15.8194 15.0296 16.8545L13.1962 17.8165C11.5869 18.661 10.7823 19.0833 9.91667 19.0833C9.05106 19.0833 8.24641 18.661 6.6371 17.8165L4.80377 16.8545C2.83141 15.8194 1.84522 15.3019 1.29762 14.3719C0.75 13.442 0.75 12.2847 0.75 9.97029V9.86304C0.75 7.54861 0.75 6.3914 1.29762 5.46143C1.84522 4.53146 2.83141 4.01394 4.80377 2.97889L6.6371 2.01681C8.24641 1.17227 9.05106 0.75 9.91667 0.75C10.7823 0.75 11.5869 1.17227 13.1962 2.01681Z"
      stroke="white"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
    <Path
      d="M18.1667 5.79167L14.5 7.625M14.5 7.625C14.5 7.625 14.2207 7.76467 14.0417 7.85417C12.4307 8.65964 9.91667 9.91667 9.91667 9.91667M14.5 7.625V10.8333M14.5 7.625L5.79167 3.04167M9.91667 9.91667L1.66667 5.79167M9.91667 9.91667V18.625"
      stroke="white"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

const RowChevron = () => (
  <Svg width={7} height={12} viewBox="0 0 6.28711 11.3691" fill="none">
    <Path
      d="M0.750001 0.75L5.53711 5.58691L0.750001 10.6191"
      stroke="white"
      strokeOpacity={0.5}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const MembershipBadge = ({ tier }: { tier: RewardsTier }) => {
  return (
    <View className="h-[35px] min-w-[160px] flex-row items-center justify-center gap-1.5 rounded-full bg-[#1c1c1c] px-3.5">
      <Svg width={19} height={19} viewBox="0 0 18.9575 18.9575" fill="none">
        <Path
          d="M10.2021 3.85352C11.0916 6.09278 12.8652 7.86651 15.1045 8.75586L16.9248 9.47852L15.1045 10.2021C12.865 11.0916 11.0916 12.865 10.2021 15.1045L9.47852 16.9248L8.75586 15.1045C7.86651 12.8652 6.09278 11.0916 3.85352 10.2021L2.03223 9.47852L3.85352 8.75586C6.09277 7.86645 7.86645 6.09276 8.75586 3.85352L9.47852 2.03223L10.2021 3.85352Z"
          stroke="white"
          strokeOpacity={0.7}
          strokeWidth={1.5}
        />
      </Svg>
      <Text className="text-base font-medium text-white/70">{getTierDisplayName(tier)} member</Text>
    </View>
  );
};

const SettingsRow = ({
  title,
  icon,
  href,
  onPress,
  description,
  descriptionClassName,
  showDivider = false,
}: MobileSettingsRow & { showDivider?: boolean }) => {
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
      className={cn(
        'h-[60px] flex-row items-center justify-between px-5 active:opacity-70',
        showDivider && 'border-t border-white/10',
      )}
      accessibilityRole="button"
    >
      <View className="flex-1 flex-row items-center gap-2">
        <View className="w-6 items-center justify-center">{icon}</View>
        <Text className="text-base font-bold text-white">{title}</Text>
      </View>
      {description ? (
        <Text className={cn('mr-2 text-sm', descriptionClassName ?? 'text-[#ACACAC]')}>
          {description}
        </Text>
      ) : null}
      <RowChevron />
    </Pressable>
  );
};

const SettingsRowGroup = ({ rows }: { rows: MobileSettingsRow[] }) => {
  return (
    <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
      {rows.map((row, index) => (
        <SettingsRow key={row.title} {...row} showDivider={index > 0} />
      ))}
    </View>
  );
};

const MobileSettings = () => {
  const { user, handleLogout } = useUser();
  const { data: rewardsData } = useRewardsUserData();
  const currentTier = rewardsData?.currentTier ?? RewardsTier.CORE;
  const displayName = getUserDisplayName(user, 18);
  const { status: notificationStatus, request: requestNotificationPermission } =
    useNotificationPermissionStatus();

  /**
   * The way back into push notifications.
   *
   * Onboarding asks once, over the wallet screen, and marks itself seen on any
   * dismissal — including a swipe that never reached the OS prompt. After that
   * the sheet is unreachable and nothing else in the app ever asks, so without a
   * row here a cardholder who swiped it away has no route to notifications at
   * all. That is not hypothetical: it is why card-payment pushes go missing, and
   * it bites iOS hardest, since Android below 13 grants the permission at
   * install and registers a token whether or not the sheet was ever seen.
   */
  const handleNotificationsPress = () => {
    // Never asked: the OS prompt is the only thing that can change this, and
    // iOS lists an app under Settings → Notifications only once it has asked,
    // so sending them to Settings would show them a page with nothing on it.
    if (notificationStatus === 'Undetermined') {
      void requestNotificationPermission();
      return;
    }

    // Already answered — only the OS can change that answer now.
    if (Platform.OS === 'android') {
      void IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS,
        { extra: { 'android.provider.extra.APP_PACKAGE': Application.applicationId } },
      );
      return;
    }

    void Linking.openSettings();
  };

  const notificationRows: MobileSettingsRow[] =
    Platform.OS === 'web'
      ? []
      : [
          {
            title: 'Push Notifications',
            icon: <Bell size={24} color="#ffffff" strokeWidth={1.6} />,
            onPress: handleNotificationsPress,
            description: notificationStatus,
            descriptionClassName:
              notificationStatus === 'Authorized'
                ? 'text-[#94F27F]'
                : notificationStatus === 'Denied'
                  ? 'text-[#FFB347]'
                  : 'text-[#ACACAC]',
          },
        ];

  const rowGroups: MobileSettingsRow[][] = [
    [
      {
        title: 'Rewards',
        icon: <RewardsIcon />,
        href: path.REWARDS,
      },
      {
        title: 'Refer & Earn',
        icon: <UsersRound size={24} color="#ffffff" strokeWidth={1.6} />,
        href: path.REFERRAL_PROGRAM,
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
      ...notificationRows,
    ],
    [
      {
        title: 'Help & Support',
        icon: <IconImage source={HelpSupportIcon} width={24} height={24} />,
        onPress: () => openSupportDrawer(),
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
    <PageLayout
      customMobileHeader={mobileHeader}
      useDesktopBreakpoint
      className="bg-[#111111]"
      contentClassName="bg-[#111111]"
    >
      <View className="mx-auto w-full max-w-[512px] px-4 pb-10">
        <View className="items-center">
          <Pressable
            onPress={() => router.push('/settings/account' as Href)}
            className="relative h-[123px] w-[123px] items-center justify-center rounded-full bg-[#1c1c1c] active:opacity-80"
            accessibilityLabel="Edit account details"
            accessibilityRole="button"
          >
            <ProfileAvatarIcon />
          </Pressable>
          <Text className="mt-[5px] text-lg font-semibold leading-[22px] text-white">
            {displayName}
          </Text>
          <View className="mt-[11px]">
            <MembershipBadge tier={currentTier} />
          </View>
        </View>

        <View className="mt-11 gap-2.5">
          {rowGroups.map((rows, index) => (
            <SettingsRowGroup key={index} rows={rows} />
          ))}
        </View>
      </View>
    </PageLayout>
  );
};

const DesktopSettings = () => {
  const { handleLogout } = useUser();
  const { isDesktop } = useDimension();
  const { status: notificationStatus, request: requestNotificationPermission } =
    useNotificationPermissionStatus();

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
          <View className="w-[50px]" />
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
        <WhatsNewButton className="mb-1 self-center" />

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
                // Nobody has asked this user yet, so there is nothing in the OS
                // settings to turn on — iOS does not even list an app under
                // Notifications until it has requested authorization once. The
                // onboarding sheet is shown a single time and is not reachable
                // again, so without this the only way out of `Undetermined` is
                // to reinstall the app. Ask here instead.
                if (notificationStatus === 'Undetermined') {
                  void requestNotificationPermission();
                  return;
                }

                // Already answered: only the OS can change that answer.
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
            onPress={() => openSupportDrawer()}
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
  // The sidebar's Profile item lands here, and desktop is the same redesigned
  // profile screen, stretched inside the sidebar shell — see `SidebarShell` in
  // `(protected)/_layout.tsx`.
  return <MobileSettings />;
}
