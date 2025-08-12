import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Navbar from '@/components/Navbar';
import NavbarMobile from '@/components/Navbar/NavbarMobile';
import { Text } from '@/components/ui/text';
import { WalletTabs } from '@/components/Wallet';
import { useWalletTokens } from '@/hooks/useWalletTokens';

const renderInfo = (text: string) => {
  return (
    <View className="flex-1 justify-center items-center p-8">
      <Text className="text-lg">{text}</Text>
    </View>
  );
};

export default function Wallet() {
  const { isLoading, hasTokens } = useWalletTokens();

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {Platform.OS !== 'web' && <NavbarMobile />}
        {Platform.OS === 'web' && <Navbar />}
        <View className="gap-8 md:gap-16 px-4 pt-4 pb-8 w-full max-w-7xl mx-auto">
          <Text className="text-xl md:text-3xl font-semibold">Wallet</Text>
          <View>
            {isLoading ? (
              renderInfo('Loading tokens...')
            ) : hasTokens ? (
              <WalletTabs />
            ) : (
              renderInfo('No tokens found')
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
