import * as Application from 'expo-application';
import { router } from 'expo-router';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';
import { Platform, Pressable, Text, View } from 'react-native';

import FingerprintIcon from '@/assets/images/fingetprint';
import LegalIcon from '@/assets/images/legal';
import LifebuoyIcon from '@/assets/images/lifebuoy';
import LogoutIcon from '@/assets/images/logout';
import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { SettingsCard } from '@/components/Settings';
import { accounts, supports } from '@/constants/settings';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { handleLogout } = useUser();
  const { isDesktop } = useDimension();

  const accountsWithIcons = accounts.map(account => ({
    ...account,
    icon: <FingerprintIcon color="#ffffff" />,
  }));

  const supportsWithIcons = supports.map(support => {
    let icon = <LifebuoyIcon color="#ffffff" />;
    if (support.title === 'Legal') {
      icon = <LegalIcon color="#ffffff" />;
    }
    return { ...support, icon };
  });

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Pressable onPress={() => router.back()} className="p-2">
        <ChevronLeft size={24} color="#ffffff" />
      </Pressable>
      <Text className="text-white text-xl font-bold flex-1 text-center mr-10">Settings</Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="max-w-[512px] mx-auto w-full px-4 pt-8 pb-8">
        <View className="flex-row items-center justify-between mb-8">
          <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-3xl font-semibold text-white">Settings</Text>
          <View className="w-6" />
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
        className={cn('w-full mx-auto gap-3 px-4 py-4', {
          'max-w-[512px]': isDesktop,
          'max-w-7xl': !isDesktop,
        })}
      >
        {/* Account Details Card */}
        <View className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          {accountsWithIcons.slice(0, 1).map((account, index) => (
            <SettingsCard
              key={`account-${index}`}
              title={account.title}
              description={account.description}
              icon={account.icon}
              link={account.link}
              isDesktop={isDesktop}
            />
          ))}
        </View>

        {/* Help & Support and Legal Cards */}
        <View className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          <View>
            {supportsWithIcons.slice(0, 1).map((support, index) => (
              <SettingsCard
                key={`support-${index}`}
                title={support.title}
                icon={support.icon}
                link={support.link}
                isDesktop={isDesktop}
              />
            ))}
          </View>
          <View className="border-t border-[#3B3B3B]">
            {supportsWithIcons.slice(1, 2).map((support, index) => (
              <SettingsCard
                key={`support-legal-${index}`}
                title={support.title}
                icon={support.icon}
                link={support.link}
                isDesktop={isDesktop}
              />
            ))}
          </View>
        </View>

        {/* Logout Card */}
        <View className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          <SettingsCard
            key="logout"
            title="Logout"
            icon={<LogoutIcon color="#ffffff" />}
            onPress={handleLogout}
            isDesktop={isDesktop}
          />
        </View>

        {/* Build Information */}
        {Platform.OS !== 'web' && (
          <View className="px-4 pt-8 pb-2 items-center">
            <Text className="text-muted-foreground text-xs">
              {Application.applicationName || 'Solid'} v
              {Application.nativeApplicationVersion || 'Unknown'} - Build{' '}
              {Application.nativeBuildVersion || 'Unknown'}
            </Text>
          </View>
        )}
      </View>
    </PageLayout>
  );
}
