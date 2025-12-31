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
    const url =
      'https://support.solid.xyz/en/articles/13184959-legal-privacy-policy-terms-conditions#h_5cf45398ce';
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
      <Text className="mr-10 flex-1 text-center text-xl font-bold text-white">Settings</Text>
    </View>
  );

  const desktopHeader = (
    <>
      <Navbar />
      <View className="mx-auto w-full max-w-[512px] px-4 pb-8 pt-8">
        <View className="mb-8 flex-row items-center justify-between">
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
        className={cn('mx-auto w-full gap-3 px-4 py-4', {
          'max-w-[512px]': isDesktop,
          'max-w-7xl': !isDesktop,
        })}
      >
        {/* Account Details Card */}
        <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
          <SettingsCard
            title="Account details"
            icon={<Image source={AccountDetailsIcon} style={{ width: 22, height: 22 }} />}
            link="/settings/account"
            isDesktop={isDesktop}
            hideIconBackground
          />
        </View>

        {/* Security Card */}
        <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
          <SettingsCard
            title="Security"
            icon={<Image source={SecurityIcon} style={{ width: 24, height: 24 }} />}
            link="/settings/security"
            isDesktop={isDesktop}
            hideIconBackground
          />
        </View>

        {/* Help & Support Card */}
        <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
          <SettingsCard
            title="Help & Support"
            icon={<Image source={HelpSupportIcon} style={{ width: 24, height: 24 }} />}
            link="/settings/help"
            isDesktop={isDesktop}
            hideIconBackground
          />
        </View>

        {/* Logout Card */}
        <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
          <SettingsCard
            title="Logout"
            icon={<Image source={LogoutIcon} style={{ width: 23, height: 20 }} />}
            onPress={handleLogout}
            isDesktop={isDesktop}
            hideIconBackground
          />
        </View>

        {/* Legal Footer Link */}
        <View className="items-center pb-4 pt-6">
          <Pressable onPress={handleLegalPress} className="active:opacity-70">
            <Text className="text-base font-medium text-[#808080]">Legal</Text>
          </Pressable>
        </View>

        {/* Build Information */}
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
}
