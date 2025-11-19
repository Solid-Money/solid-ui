import { router } from 'expo-router';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import EmailIcon from '@/assets/images/email';
import LegalIcon from '@/assets/images/legal';
import LifebuoyIcon from '@/assets/images/lifebuoy';
import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { SettingsCard } from '@/components/Settings';
import { useDimension } from '@/hooks/useDimension';
import { cn } from '@/lib/utils';

interface SupportOption {
  title: string;
  description?: string;
  icon: React.ReactNode;
  link: string;
}

export default function Help() {
  const { isDesktop } = useDimension();

  const supportOptions: SupportOption[] = [
    {
      title: 'FAQ',
      description: 'Quick answers',
      icon: <LifebuoyIcon color="#ffffff" />,
      link: 'https://docs.solid.xyz/faq',
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
      link: 'https://docs.solid.xyz',
    },
  ];

  const mobileHeader = (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Pressable onPress={() => router.back()} className="p-2">
        <ChevronLeft size={24} color="#ffffff" />
      </Pressable>
      <Text className="text-white text-xl font-bold flex-1 text-center mr-10">Help & Support</Text>
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
        className={cn('w-full mx-auto gap-3 px-4 py-4', {
          'max-w-[512px]': isDesktop,
          'max-w-7xl': !isDesktop,
        })}
      >
        {/* Support Options */}
        <View className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          {supportOptions.map((option, index) => (
            <View key={`support-${index}`}>
              <SettingsCard
                title={option.title}
                description={option.description}
                icon={option.icon}
                link={option.link as any}
                isDesktop={isDesktop}
              />
              {index < supportOptions.length - 1 && <View className="border-t border-[#2a2a2a]" />}
            </View>
          ))}
        </View>

        {/* Additional Help Text */}
        <View className="px-4 pt-6 pb-2">
          <Text className="text-muted-foreground text-sm text-center">
            Need more help? Email <Text className="text-white font-medium">hello@solid.xyz</Text>
          </Text>
        </View>
      </View>
    </PageLayout>
  );
}
