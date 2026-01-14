import { Platform, View } from 'react-native';

import { ActivityTabs, ActivityTransactions } from '@/components/Activity';
import ActivityRefreshButton from '@/components/Activity/ActivityRefreshButton';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useActivity } from '@/hooks/useActivity';
import { useCardStatus } from '@/hooks/useCardStatus';
import { ActivityTab } from '@/lib/types';
import { hasCard } from '@/lib/utils';

export default function Activity() {
  const { data: cardStatus, isLoading: isCardLoading } = useCardStatus();
  const { refetchAll, isSyncing, isLoading } = useActivity();
  const isWeb = Platform.OS === 'web';
  const userHasCard = hasCard(cardStatus);

  return (
    <PageLayout isLoading={isCardLoading} scrollable={isWeb}>
      <View className={`mx-auto w-full max-w-7xl px-4 pb-8 pt-6 md:py-12 ${isWeb ? '' : 'flex-1'}`}>
        <View className="flex-row items-center justify-between">
          <Text className="text-3xl font-semibold">Activity</Text>

          {/* Web-only refresh button (pull-to-refresh doesn't work on web) */}
          {isWeb && !userHasCard && (
            <ActivityRefreshButton
              onRefresh={refetchAll}
              isSyncing={isSyncing}
              isLoading={isLoading}
            />
          )}
        </View>
        {userHasCard ? <ActivityTabs /> : <ActivityTransactions tab={ActivityTab.WALLET} />}
      </View>
      {/* Hidden modal that responds to store state changes from activity clicks */}
      <DepositOptionModal trigger={null} />
    </PageLayout>
  );
}
