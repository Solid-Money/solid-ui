import { ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, View } from 'react-native';
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import {
  ArrowDownLeft,
  Bell,
  ChevronRight,
  CreditCard,
  Megaphone,
  ShieldCheck,
  Sparkle,
  Wallet,
} from 'lucide-react-native';

import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { ProfileRow, ProfileRowGroup, ProfileSectionLabel } from '@/components/Profile/ProfileRow';
import ToggleSwitch from '@/components/Profile/ToggleSwitch';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import useNotificationPermissionStatus from '@/hooks/useNotificationPermissionStatus';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { NotificationPreferences } from '@/lib/api';
import { cn } from '@/lib/utils';

const ICON_SIZE = 18;
const ICON_COLOR = '#FFFFFF';
const SETTINGS_APP = Platform.OS === 'android' ? 'Android Settings' : 'iOS Settings';

type PreferenceRow = {
  key: keyof NotificationPreferences;
  icon: ReactNode;
  title: string;
  subtitle: string;
};

const SECTIONS: { title: string; rows: (PreferenceRow | 'payment-approvals')[] }[] = [
  {
    title: 'Card',
    rows: [
      {
        key: 'cardPayments',
        icon: <CreditCard size={ICON_SIZE} color={ICON_COLOR} />,
        title: 'Card payments',
        subtitle: 'Purchases, refunds and declines',
      },
      'payment-approvals',
    ],
  },
  {
    title: 'Money',
    rows: [
      {
        key: 'depositsTransfers',
        icon: <ArrowDownLeft size={ICON_SIZE} color={ICON_COLOR} />,
        title: 'Deposits & transfers',
        subtitle: 'When money arrives or leaves',
      },
      {
        key: 'earn',
        icon: <Wallet size={ICON_SIZE} color={ICON_COLOR} />,
        title: 'Earn',
        subtitle: 'Weekly yield summary',
      },
    ],
  },
  {
    title: 'Rewards & news',
    rows: [
      {
        key: 'cashbackRewards',
        icon: <Sparkle size={ICON_SIZE} color={ICON_COLOR} />,
        title: 'Cashback & rewards',
        subtitle: 'Cashback earned, tier changes',
      },
      {
        key: 'productNews',
        icon: <Megaphone size={ICON_SIZE} color={ICON_COLOR} />,
        title: 'Product news & offers',
        subtitle: 'New features and promotions',
      },
    ],
  },
];

/**
 * The way back into push notifications, and what the OS says about them now.
 *
 * Onboarding asks once, over the wallet screen, and marks itself seen on any
 * dismissal — including a swipe that never reached the OS prompt. After that
 * the sheet is unreachable and nothing else in the app ever asks, so without
 * this card a cardholder who swiped it away has no route to notifications at
 * all. That is not hypothetical: it is why card-payment pushes go missing, and
 * it bites iOS hardest, since Android below 13 grants the permission at install
 * and registers a token whether or not the sheet was ever seen.
 */
const PushPermissionCard = () => {
  const { status, request } = useNotificationPermissionStatus();

  const handlePress = () => {
    // Never asked: the OS prompt is the only thing that can change this, and
    // iOS lists an app under Settings → Notifications only once it has asked,
    // so sending them to Settings would show them a page with nothing on it.
    if (status === 'Undetermined') {
      void request();
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

  const copy =
    status === 'Authorized'
      ? { title: 'Push notifications are on', detail: `Manage permission in ${SETTINGS_APP}` }
      : status === 'Denied'
        ? { title: 'Push notifications are off', detail: `Turn them on in ${SETTINGS_APP}` }
        : { title: 'Turn on push notifications', detail: 'Get alerts for payments and deposits' };
  const isOn = status === 'Authorized';

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={copy.title}
      className="flex-row items-center gap-3 rounded-2xl bg-[#1C1C1C] p-4 active:opacity-70"
    >
      <View
        className={cn(
          'h-11 w-11 items-center justify-center rounded-full',
          isOn ? 'bg-[#94F27F]/15' : 'bg-[#F2B84B]/15',
        )}
      >
        <Bell size={20} color={isOn ? '#94F27F' : '#F2B84B'} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-white">{copy.title}</Text>
        <Text className="text-sm text-[#8E8E8E]">{copy.detail}</Text>
      </View>
      <ChevronRight size={18} color="#8E8E8E" />
    </Pressable>
  );
};

/**
 * Settings → Notifications (Figma "Notifications").
 *
 * The OS permission at the top, then which kinds of push the account wants.
 * The categories only appear once the backend stores them — until then there
 * is nothing for a switch to change, so the screen shows the permission alone.
 */
export default function Notifications() {
  const { isDesktop } = useDimension();
  const { preferences, isLoading, isError, update, isSaveError } = useNotificationPreferences();

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <BackButton />
      <Text className="mr-[50px] flex-1 text-center text-xl font-bold text-white">
        Notifications
      </Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="mx-auto w-full max-w-[512px] px-4 pb-8 pt-8">
        <View className="mb-8 flex-row items-center justify-between">
          <BackButton />
          <Text className="text-3xl font-semibold text-white">Notifications</Text>
          <View className="w-[50px]" />
        </View>
      </View>
    </>
  );

  return (
    <PageLayout
      customMobileHeader={mobileHeader}
      customDesktopHeader={desktopHeader}
      useDesktopBreakpoint
    >
      <View
        className={cn('mx-auto w-full px-4 pb-32 pt-2', {
          'max-w-[512px]': isDesktop,
          'max-w-7xl': !isDesktop,
        })}
      >
        <PushPermissionCard />

        {isLoading ? (
          <ActivityIndicator className="mt-8" size="small" color="#8E8E8E" />
        ) : isError ? (
          <Text className="mt-6 px-1 text-sm text-[#8E8E8E]">
            Couldn&apos;t load your notification choices. Try again later.
          </Text>
        ) : preferences ? (
          <>
            {SECTIONS.map(section => (
              <View key={section.title}>
                <ProfileSectionLabel>{section.title}</ProfileSectionLabel>
                <ProfileRowGroup>
                  {section.rows.map(row =>
                    row === 'payment-approvals' ? (
                      <ProfileRow
                        key={row}
                        icon={<ShieldCheck size={ICON_SIZE} color={ICON_COLOR} />}
                        title="Payment approvals"
                        subtitle="3D Secure for online payments"
                        value="Always on"
                      />
                    ) : (
                      <ProfileRow
                        key={row.key}
                        icon={row.icon}
                        title={row.title}
                        subtitle={row.subtitle}
                        accessory={
                          <ToggleSwitch
                            value={preferences[row.key]}
                            onValueChange={value => update({ [row.key]: value })}
                            accessibilityLabel={row.title}
                          />
                        }
                      />
                    ),
                  )}
                </ProfileRowGroup>
              </View>
            ))}
            {isSaveError ? (
              <Text className="mt-2 px-1 text-sm text-red-400">
                Couldn&apos;t save that change. Please try again.
              </Text>
            ) : null}
          </>
        ) : null}

        <Text className="mt-3 px-1 text-sm leading-5 text-[#8E8E8E]">
          Security alerts and important account notices are always sent by email.
        </Text>
      </View>
    </PageLayout>
  );
}
