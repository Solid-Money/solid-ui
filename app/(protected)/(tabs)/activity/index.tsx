import { View } from 'react-native';

import { ActivityTabs, ActivityTransactions } from '@/components/Activity';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useCardStatus } from '@/hooks/useCardStatus';
import { ActivityTab, CardStatus } from '@/lib/types';

export default function Activity() {
  const { data: cardStatus, isLoading: isCardLoading } = useCardStatus();

  const hasCard =
    cardStatus?.status === CardStatus.ACTIVE || cardStatus?.status === CardStatus.FROZEN;

  return (
    <PageLayout desktopOnly isLoading={isCardLoading}>
      <View className="gap-8 md:gap-16 px-4 py-8 md:py-12 w-full max-w-7xl mx-auto">
        <Text className="text-xl md:text-3xl font-semibold">Activity</Text>
        {hasCard ? <ActivityTabs /> : <ActivityTransactions tab={ActivityTab.WALLET} />}
      </View>
    </PageLayout>
  );
}
