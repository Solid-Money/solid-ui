import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Navbar from '@/components/Navbar';
import NavbarMobile from '@/components/Navbar/NavbarMobile';
import { Text } from '@/components/ui/text';
import { ActivityTransactions } from '@/components/Activity';

export default function Activity() {
  return (
    <SafeAreaView className="bg-background text-foreground flex-1">
      <ScrollView className="flex-1">
        {Platform.OS !== 'web' && <NavbarMobile />}
        {Platform.OS === 'web' && <Navbar />}
        <View className="gap-8 md:gap-16 px-4 pt-4 pb-8 md:pt-12 w-full max-w-7xl mx-auto">
          <Text className="text-xl md:text-3xl font-semibold">Activity</Text>
          <ActivityTransactions />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
