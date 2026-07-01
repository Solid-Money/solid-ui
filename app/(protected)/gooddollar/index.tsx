import { View } from 'react-native';

import GoodDollarClaim from '@/components/GoodDollar/GoodDollarClaim';
import Navbar from '@/components/Navbar';
import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';

const mobileHeader = (
  <View className="px-4 pb-0 pt-1">
    <BackButton />
  </View>
);

const desktopHeader = (
  <>
    <Navbar />
    <View className="mx-auto w-full max-w-[512px] px-4 pb-8 pt-8">
      <View className="mb-8 flex-row items-center justify-between">
        <BackButton />
        <Text className="text-3xl font-semibold text-white">GoodDollar</Text>
        <View className="w-6" />
      </View>
    </View>
  </>
);

export default function GoodDollarScreen() {
  return (
    <PageLayout
      customMobileHeader={mobileHeader}
      customDesktopHeader={desktopHeader}
      useDesktopBreakpoint
    >
      <GoodDollarClaim />
    </PageLayout>
  );
}
