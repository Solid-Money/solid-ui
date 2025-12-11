import * as Application from 'expo-application';
import { router } from 'expo-router';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';
import { Image, Linking, Platform, Pressable, Text, View } from 'react-native';

import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { SettingsCard } from '@/components/Settings';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { cn } from '@/lib/utils';

const AccountDetailsIcon = require('@/assets/images/settings_account_details.png');
const SecurityIcon = require('@/assets/images/settings_security.png');
const HelpSupportIcon = require('@/assets/images/settings_help_and_support.png');
const LogoutIcon = require('@/assets/images/settings_logout.png');

export default function Settings() {
  const { handleLogout } = useUser();
  const { isDesktop } = useDimension();

  const handleLegalPress = () => {
    const url = 'https://docs.solid.xyz/terms-and-conditions';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

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
          <SettingsCard
            title="Account details"
            icon={<Image source={AccountDetailsIcon} style={{ width: 22, height: 22 }} />}
            link="/settings/account"
            isDesktop={isDesktop}
            hideIconBackground
          />
        </View>

        {/* Security Card */}
        <View className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          <SettingsCard
            title="Security"
            icon={<Image source={SecurityIcon} style={{ width: 24, height: 24 }} />}
            link="/settings/security"
            isDesktop={isDesktop}
            hideIconBackground
          />
        </View>

        {/* Help & Support Card */}
        <View className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          <SettingsCard
            title="Help & Support"
            icon={<Image source={HelpSupportIcon} style={{ width: 24, height: 24 }} />}
            link="/settings/help"
            isDesktop={isDesktop}
            hideIconBackground
          />
        </View>

        {/* Logout Card */}
        <View className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          <SettingsCard
            title="Logout"
            icon={<Image source={LogoutIcon} style={{ width: 23, height: 20 }} />}
            onPress={handleLogout}
            isDesktop={isDesktop}
            hideIconBackground
          />
        </View>

        {/* Legal Footer Link */}
        <View className="items-center pt-6 pb-4">
          <Pressable onPress={handleLegalPress} className="active:opacity-70">
            <Text className="text-[#808080] text-base font-medium">Legal</Text>
          </Pressable>
        </View>

        {/* Build Information */}
        {Platform.OS !== 'web' && (
          <View className="px-4 pb-2 items-center">
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
