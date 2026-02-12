import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';

import EmailIcon from '@/assets/images/email';
import LegalIcon from '@/assets/images/legal';
import LifebuoyIcon from '@/assets/images/lifebuoy';
import MessageCircle from '@/assets/images/messages';
import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { SettingsCard } from '@/components/Settings';
import { useDimension } from '@/hooks/useDimension';
import { openIntercom } from '@/lib/intercom';
import { cn } from '@/lib/utils';

interface SupportOption {
  title: string;
  description?: string;
  icon: React.ReactNode;
  link?: string;
  onPress?: () => void;
}

export default function Help() {
  const { isDesktop } = useDimension();

  const supportOptions: SupportOption[] = [
    {
      title: 'Chat with us',
      description: 'Live chat support',
      icon: <MessageCircle color="#ffffff" />,
      onPress: openIntercom,
    },
    {
      title: 'FAQ',
      description: 'Quick answers',
      icon: <LifebuoyIcon color="#ffffff" />,
      link: 'https://support.solid.xyz/en/collections/16780872-troubleshooting',
    },
    {
      title: 'Email Support',
      description: 'Contact our team',
      icon: <EmailIcon color="#ffffff" />,
      link: 'mailto:hello@solid.xyz',
    },
    {
      title: 'Documentation',
      description: 'Learn more',
      icon: <LegalIcon color="#ffffff" />,
      link: 'https://support.solid.xyz',
    },
  ];

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Pressable onPress={() => router.back()} className="p-2">
        <ChevronLeft size={24} color="#ffffff" />
      </Pressable>
      <Text className="mr-10 flex-1 text-center text-xl font-bold text-white">Help & Support</Text>
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
          <Text className="text-3xl font-semibold text-white">Help & Support</Text>
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
        {/* Support Options */}
        <View className="overflow-hidden rounded-xl bg-[#1c1c1c]">
          {supportOptions.map((option, index) => (
            <View key={`support-${index}`}>
              <SettingsCard
                title={option.title}
                description={option.description}
                icon={option.icon}
                link={option.link as any}
                onPress={option.onPress}
                isDesktop={isDesktop}
              />
              {index < supportOptions.length - 1 && <View className="border-t border-[#2a2a2a]" />}
            </View>
          ))}
        </View>

        {/* Additional Help Text */}
        <View className="px-4 pb-2 pt-6">
          <Text className="text-center text-sm text-muted-foreground">
            Need more help? Email <Text className="font-medium text-white">hello@solid.xyz</Text>
          </Text>
        </View>
      </View>
    </PageLayout>
  );
}
