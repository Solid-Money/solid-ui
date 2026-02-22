import { Platform, View } from 'react-native';

import { ActivityTabs, ActivityTransactions } from '@/components/Activity';
import ActivityRefreshButton from '@/components/Activity/ActivityRefreshButton';
import LazyDepositOptionModal from '@/components/DepositOption/LazyDepositOptionModal';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useActivityRefresh } from '@/hooks/useActivityRefresh';
import { useCardStatus } from '@/hooks/useCardStatus';
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import { ActivityTab } from '@/lib/types';
import { cn, hasCard } from '@/lib/utils';

export default function Activity() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.ACTIVITY_SCREEN });

  const { data: cardStatus, isLoading: isCardStatusLoading } = useCardStatus();
  // Use lightweight hook to avoid re-renders from activity data changes
  const { refetchAll, isSyncing } = useActivityRefresh();
  const isWeb = Platform.OS === 'web';
  const userHasCard = hasCard(cardStatus);

  const stickyHeader = (
    <View className="mx-auto w-full max-w-7xl px-4 pb-[10px] pt-6 md:pt-12">
      <View className="flex-row items-center justify-between">
        <Text className="text-3xl font-semibold">Activity</Text>

        {/* Web-only refresh button (pull-to-refresh doesn't work on web) */}
        {isWeb && !userHasCard && (
          <ActivityRefreshButton
            onRefresh={refetchAll}
            isSyncing={isSyncing}
            isLoading={isSyncing}
          />
        )}
      </View>
    </View>
  );

  return (
    <PageLayout isLoading={isCardStatusLoading} stickyHeader={stickyHeader}>
      <View
        className={cn('mx-auto w-full max-w-7xl px-4 pb-8 md:pb-12', {
          'flex-1': !isWeb,
        })}
      >
        {userHasCard ? <ActivityTabs /> : <ActivityTransactions tab={ActivityTab.WALLET} />}
      </View>
      {/* Hidden modal that responds to store state changes from activity clicks */}
      <LazyDepositOptionModal trigger={null} />
    </PageLayout>
  );
}
