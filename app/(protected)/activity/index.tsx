import { useCallback, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import ActivityFilters from '@/components/Activity/ActivityFilters';
import ActivityRefreshButton from '@/components/Activity/ActivityRefreshButton';
import UnifiedActivityList from '@/components/Activity/UnifiedActivityList';
import LazyDepositOptionModal from '@/components/DepositOption/LazyDepositOptionModal';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useActivityRefresh } from '@/hooks/useActivityRefresh';
import { useCardStatus } from '@/hooks/useCardStatus';
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import { useUnifiedActivity } from '@/hooks/useUnifiedActivity';
import { ActivityTab } from '@/lib/types';
import { cn, hasCard } from '@/lib/utils';
import { ActivityFilter, filterUnifiedActivity } from '@/lib/utils/unifiedActivity';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

const SOURCE_FILTERS: ActivityFilter[] = [ActivityTab.ALL, ActivityTab.WALLET, ActivityTab.CARD];

/**
 * `?tab=` is still how the detail screen remembers where the user came from, and
 * older links carry `wallet` or `card`. Anything else — including no param at
 * all, and the retired `progress` tab — lands on All, which is the default the
 * redesign asks for.
 */
const toActivityFilter = (tab: string | undefined): ActivityFilter =>
  SOURCE_FILTERS.includes(tab as ActivityFilter) ? (tab as ActivityFilter) : ActivityTab.ALL;

// This route is a protected stack screen so native back gestures can dismiss it.
export default function Activity() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.ACTIVITY_SCREEN });

  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: cardStatus, isLoading: isCardStatusLoading } = useCardStatus();
  const userHasCard = hasCard(cardStatus);
  // Without a card the chips are hidden, so a `?tab=card` link — from a card
  // transaction opened before the card was closed, say — would otherwise strand
  // the user on an empty list with no way back to All.
  const tab = userHasCard ? toActivityFilter(params.tab) : ActivityTab.ALL;
  // Lightweight hook for the web refresh button, so its state doesn't re-render
  // the list on every activity change.
  const { refetchAll: refetchForButton, isSyncing: isButtonSyncing } = useActivityRefresh();

  const {
    items,
    isLoading,
    isSyncing,
    isSyncStale,
    hasNextPage,
    isFetchingNextPage,
    loadMore,
    refetchAll,
  } = useUnifiedActivity();

  const visibleItems = useMemo(
    () => filterUnifiedActivity(items, { tab, query }),
    [items, tab, query],
  );

  const handleTabChange = useCallback(
    (nextTab: ActivityFilter) => router.setParams({ tab: nextTab }),
    [router],
  );

  const isWeb = Platform.OS === 'web';
  const searchTerm = query.trim();

  const pageHeader = (
    <View className="mx-auto w-full max-w-7xl px-4 pb-[10px] pt-6 md:pt-12">
      <View className="flex-row items-center justify-between">
        <Text className="text-3xl font-semibold">Activity</Text>

        {/* Web-only refresh button (pull-to-refresh doesn't work on web) */}
        {isWeb && (
          <ActivityRefreshButton
            onRefresh={refetchForButton}
            isSyncing={isButtonSyncing}
            isLoading={isButtonSyncing}
          />
        )}
      </View>
    </View>
  );

  return (
    <PageLayout
      isLoading={isCardStatusLoading}
      mobileHeaderLeftAction="back"
      mobileHeaderRightAction="help"
      onMobileHeaderHelpPress={() => openSupportDrawer()}
    >
      {pageHeader}
      <View
        className={cn('mx-auto w-full max-w-7xl px-4 pb-8 md:pb-12', {
          'flex-1': !isWeb,
        })}
      >
        <View className="pb-2 pt-2">
          <ActivityFilters
            value={tab}
            onChange={handleTabChange}
            query={query}
            onQueryChange={setQuery}
            isSearchOpen={isSearchOpen}
            onSearchOpenChange={setIsSearchOpen}
            showSourceFilters={userHasCard}
          />
        </View>

        <UnifiedActivityList
          items={visibleItems}
          tab={tab}
          userHasCard={userHasCard}
          isLoading={isLoading}
          isSyncing={isSyncing}
          isSyncStale={isSyncStale}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={loadMore}
          onRefresh={refetchAll}
          emptyTitle={searchTerm ? 'No matching activity' : 'No transactions found'}
          emptyDescription={
            searchTerm
              ? // Search only sees what has been loaded, so point at the button
                // that loads the rest rather than implying there is nothing.
                'Try a different merchant, token or place — or load more history'
              : 'Start by making a deposit or creating a card'
          }
        />
      </View>
      {/* Hidden modal that responds to store state changes from activity clicks */}
      <LazyDepositOptionModal trigger={null} />
    </PageLayout>
  );
}
