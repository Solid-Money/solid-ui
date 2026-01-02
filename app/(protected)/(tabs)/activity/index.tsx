import { Platform, View } from 'react-native';

import { ActivityTabs, ActivityTransactions } from '@/components/Activity';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useCardStatus } from '@/hooks/useCardStatus';
import { ActivityTab } from '@/lib/types';
import { hasCard } from '@/lib/utils';
import ActivityRefreshButton from '@/components/Activity/ActivityRefreshButton';
import { useActivity } from '@/hooks/useActivity';

export default function Activity() {
  const { data: cardStatus, isLoading: isCardLoading } = useCardStatus();
  const { refetchAll, isSyncing, isLoading } = useActivity();
  const isWeb = Platform.OS === 'web';
  const userHasCard = hasCard(cardStatus);

  return (
    <PageLayout desktopOnly isLoading={isCardLoading} scrollable={isWeb}>
      <View
        className={`mx-auto w-full max-w-7xl gap-8 px-4 py-8 md:py-12 ${isWeb ? '' : 'flex-1'}`}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-semibold md:text-3xl">Activity</Text>

          {/* Web-only refresh button (pull-to-refresh doesn't work on web) */}
          {isWeb && !userHasCard && (
            <View className="flex-row justify-end px-4 py-2">
              <ActivityRefreshButton
                onRefresh={refetchAll}
                isSyncing={isSyncing}
                isLoading={isLoading}
              />
            </View>
          )}
        </View>
        {userHasCard ? <ActivityTabs /> : <ActivityTransactions tab={ActivityTab.WALLET} />}
      </View>
      {/* Hidden modal that responds to store state changes from activity clicks */}
      <DepositOptionModal trigger={null} />
    </PageLayout>
  );
}
