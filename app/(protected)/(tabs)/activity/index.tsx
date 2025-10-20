import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityTabs, ActivityTransactions } from '@/components/Activity';
import Navbar from '@/components/Navbar';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { useCardStatus } from '@/hooks/useCardStatus';
import { ActivityTab, CardStatus } from '@/lib/types';

export default function Activity() {
  const { isScreenMedium } = useDimension();
  const { data: cardStatus } = useCardStatus();

  const hasCard =
    cardStatus?.status === CardStatus.ACTIVE || cardStatus?.status === CardStatus.FROZEN;

  return (
    <SafeAreaView className="bg-background text-foreground flex-1">
      <ScrollView className="flex-1">
        {isScreenMedium && <Navbar />}
        <View className="gap-8 md:gap-16 px-4 py-8 md:py-12 w-full max-w-7xl mx-auto">
          <Text className="text-xl md:text-3xl font-semibold">Activity</Text>
          {hasCard ? <ActivityTabs /> : <ActivityTransactions tab={ActivityTab.WALLET} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
