import { Platform, View } from 'react-native';

import { ActivityTabs, ActivityTransactions } from '@/components/Activity';
import ActivityRefreshButton from '@/components/Activity/ActivityRefreshButton';
import LazyDepositOptionModal from '@/components/DepositOption/LazyDepositOptionModal';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useActivityRefresh } from '@/hooks/useActivityRefresh';
import { useActivitySSE } from '@/hooks/useActivitySSE';
import { useCardStatus } from '@/hooks/useCardStatus';
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import { ActivityTab } from '@/lib/types';
import { cn, hasCard } from '@/lib/utils';

export default function Activity() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.ACTIVITY_SCREEN });

  const { data: cardStatus } = useCardStatus();
  // Use lightweight hook to avoid re-renders from activity data changes
  const { refetchAll, isSyncing } = useActivityRefresh();
  const isWeb = Platform.OS === 'web';

  // Enable real-time activity updates via SSE only when viewing this tab
  // Connection automatically closes when navigating away (singleton reference counting)
  useActivitySSE();
  const userHasCard = hasCard(cardStatus);

  return (
    <PageLayout>
      <View
        className={cn('mx-auto w-full max-w-7xl px-4 pb-8 pt-6 md:py-12', {
          'flex-1': !isWeb,
        })}
      >
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
        {userHasCard ? <ActivityTabs /> : <ActivityTransactions tab={ActivityTab.WALLET} />}
      </View>
      {/* Hidden modal that responds to store state changes from activity clicks */}
      <LazyDepositOptionModal trigger={null} />
    </PageLayout>
  );
}
