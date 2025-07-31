import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsCard } from '@/components/Settings';
import useUser from '@/hooks/useUser';
import { eclipseAddress } from '@/lib/utils';
import { Address } from 'viem';

interface Detail {
  title: string;
  description?: string | Address;
  isAddress?: boolean;
}

export default function Account() {
  const { user } = useUser();

  const details: Detail[] = [
    {
      title: 'User Name',
      description: user?.username,
    },
    {
      title: 'Wallet Address',
      description: user?.safeAddress,
      isAddress: true,
    },
  ];

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom']}
    >
      <ScrollView className="flex-1">
        <View className="w-full max-w-7xl mx-auto gap-4 px-4 py-8">
          <View className="bg-card rounded-xl">
            {details.map((detail, index) => (
              <SettingsCard
                key={`detail-${index}`}
                title={detail.title}
                description={
                  detail.isAddress
                    ? eclipseAddress(detail.description as Address)
                    : detail.description
                }
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
