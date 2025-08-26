import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Href, router } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';

import Navbar from '@/components/Navbar';
import { SettingsCard } from '@/components/Settings';
import { useDimension } from '@/hooks/useDimension';
import useUser from '@/hooks/useUser';
import { eclipseAddress } from '@/lib/utils';
import { Address } from 'viem';
import UsernameIcon from '@/assets/images/username';
import WalletIcon from '@/assets/images/wallet';
import EmailIcon from '@/assets/images/email';
import CopyToClipboard from '@/components/CopyToClipboard';

interface Detail {
  title: string;
  description?: string | Address;
  isAddress?: boolean;
  icon?: React.ReactNode;
  link?: Href;
}

export default function Account() {
  const { user } = useUser();
  const { isDesktop } = useDimension();

  const details: Detail[] = [
    {
      title: 'User Name',
      description: user?.username,
      icon: <UsernameIcon color="#ffffff" />,
    },
    {
      title: 'Wallet Address',
      description: user?.safeAddress,
      isAddress: true,
      icon: <WalletIcon color="#ffffff" />,
    },
    {
      title: 'Email',
      description: user?.email,
      icon: <EmailIcon color="#ffffff" />,
      link: '/settings/email',
    },
  ];

  return (
    <SafeAreaView
      className="bg-black text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {/* Desktop Navbar */}
        {isDesktop && <Navbar />}

        {/* Mobile Header */}
        {!isDesktop && (
          <View className="flex-row items-center justify-between px-4 py-3">
            <Pressable onPress={() => router.back()} className="p-2">
              <ChevronLeft size={24} color="#ffffff" />
            </Pressable>
            <Text className="text-white text-xl font-bold flex-1 text-center mr-10">
              Account details
            </Text>
          </View>
        )}

        {/* Desktop Header */}
        {isDesktop && (
          <View className="max-w-[512px] mx-auto w-full px-4 pt-8 pb-8">
            <View className="flex-row items-center justify-between mb-8">
              <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
                <ArrowLeft color="white" />
              </Pressable>
              <Text className="text-3xl font-semibold text-white">Account details</Text>
              <View className="w-6" />
            </View>
          </View>
        )}

        <View
          className={`w-full ${isDesktop ? 'max-w-[512px]' : 'max-w-7xl'} mx-auto gap-3 px-4 py-4`}
        >
          <View className="bg-[#1c1c1c] rounded-xl overflow-hidden">
            {details.map((detail, index) => (
              <SettingsCard
                key={`detail-${index}`}
                title={detail.title}
                description={
                  detail.isAddress
                    ? eclipseAddress(detail.description as Address)
                    : detail.description
                }
                icon={detail.icon}
                link={detail.link}
                isDesktop={isDesktop}
                customAction={
                  detail.isAddress && user?.safeAddress ? (
                    <CopyToClipboard text={user.safeAddress} />
                  ) : detail.link ? (
                    <ChevronRight size={20} color="#ffffff" />
                  ) : null
                }
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
