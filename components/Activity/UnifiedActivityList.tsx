import { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import UnifiedActivityRow, {
  useUnifiedActivityPress,
} from '@/components/Activity/UnifiedActivityRow';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCashbacks } from '@/hooks/useCashbacks';
import { ActivityGroup, ActivityTab } from '@/lib/types';
import { cn } from '@/lib/utils';
import { groupByTime, TimeGroup } from '@/lib/utils/timeGrouping';
import { UnifiedActivityItem } from '@/lib/utils/unifiedActivity';

type UnifiedActivityListProps = {
  items: UnifiedActivityItem[];
  /** Which chip is active — carried into the detail route so back returns here. */
  tab: ActivityTab;
  userHasCard: boolean;
  isLoading: boolean;
  isSyncing?: boolean;
  isSyncStale?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Desktop's middle date column. The full-page list has the width for it. */
  showTimestamp?: boolean;
  /** Content rendered above the list via FlashList's ListHeaderComponent.
   * Use this instead of nesting FlashList inside a ScrollView. */
  listHeaderComponent?: React.ReactElement;
};

type Row = TimeGroup<UnifiedActivityItem>;

function LoadingSkeleton() {
  return (
    <View className="gap-3">
      <Skeleton className="h-16 w-full rounded-xl bg-card md:rounded-twice" />
      <Skeleton className="h-16 w-full rounded-xl bg-card md:rounded-twice" />
      <Skeleton className="h-16 w-full rounded-xl bg-card md:rounded-twice" />
    </View>
  );
}

function ItemSeparator() {
  return <View className="h-0" />;
}

/**
 * The Activity screen's list (Figma 24781:7407): one time-grouped feed of wallet
 * and card rows, each day's rows sharing a single rounded card.
 *
 * Pending rows sit in their day rather than in a group of their own — the chip
 * on the row already says they are pending, and hoisting them broke the
 * chronology a user scrolls by.
 */
export default function UnifiedActivityList({
  items,
  tab,
  userHasCard,
  isLoading,
  isSyncing = false,
  isSyncStale = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  onRefresh,
  emptyTitle = 'No transactions found',
  emptyDescription,
  showTimestamp = true,
  listHeaderComponent,
}: UnifiedActivityListProps) {
  const { data: cashbacks } = useCashbacks({ enabled: userHasCard });
  const { provider } = useCardProvider();
  const handlePress = useUnifiedActivityPress(tab);

  // React state updates async, so several quick taps on "Load More" could all
  // fire before `isFetchingNextPage` reflects the first. This ref is synchronous.
  const isLoadingMoreRef = useRef(false);

  const rows = useMemo(() => groupByTime(items), [items]);

  const getPosition = useCallback(
    (index: number) => ({
      isFirst: index === 0 || rows[index - 1]?.type === ActivityGroup.HEADER,
      isLast: index === rows.length - 1 || rows[index + 1]?.type === ActivityGroup.HEADER,
    }),
    [rows],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Row; index: number }) => {
      if (item.type === ActivityGroup.HEADER) {
        return (
          <View className="bg-background pb-3 pt-6">
            <Text className="text-base font-normal text-white/50">{item.data.title}</Text>
          </View>
        );
      }

      const { isFirst, isLast } = getPosition(index);

      return (
        <UnifiedActivityRow
          item={item.data}
          cashbacks={cashbacks}
          provider={provider}
          isFirst={isFirst}
          isLast={isLast}
          showTimestamp={showTimestamp}
          onPress={handlePress}
        />
      );
    },
    [cashbacks, getPosition, handlePress, provider, showTimestamp],
  );

  const keyExtractor = useCallback((item: Row, index: number) => {
    if (item.type === ActivityGroup.HEADER) return `header-${item.data.key}-${index}`;
    // The item id is stable from the moment a row appears — never the tx hash,
    // which arrives later over SSE and would flip the key, remounting the row.
    return `item-${item.data.id}`;
  }, []);

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View className="py-8">
          <LoadingSkeleton />
        </View>
      );
    }

    return (
      <View className="px-4 py-16">
        <Text className="text-center text-lg text-muted-foreground">
          {isSyncing && isSyncStale ? 'Syncing your transaction history...' : emptyTitle}
        </Text>
        {isSyncing && isSyncStale ? (
          <>
            <Text className="mt-2 text-center text-sm text-muted-foreground">
              This may take a moment for new accounts
            </Text>
            <View className="mt-4">
              <LoadingSkeleton />
            </View>
          </>
        ) : (
          !!emptyDescription && (
            <Text className="mt-2 text-center text-sm text-muted-foreground">
              {emptyDescription}
            </Text>
          )
        )}
      </View>
    );
  }, [emptyDescription, emptyTitle, isLoading, isSyncing, isSyncStale]);

  const handleLoadMore = useCallback(() => {
    if (!onLoadMore || isFetchingNextPage || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    onLoadMore();
    // The two feeds page independently, so there is no single promise to await;
    // release on the next tick and let `isFetchingNextPage` hold the button.
    setTimeout(() => {
      isLoadingMoreRef.current = false;
    }, 0);
  }, [isFetchingNextPage, onLoadMore]);

  const renderFooter = useCallback(() => {
    if (!hasNextPage) return null;
    return (
      <View className="items-center py-7">
        <Pressable
          onPress={handleLoadMore}
          disabled={isFetchingNextPage}
          className={cn(
            'flex-row items-center gap-2 rounded-lg bg-card px-6 py-3',
            isFetchingNextPage ? 'opacity-70' : 'active:opacity-70',
          )}
        >
          {isFetchingNextPage && <ActivityIndicator size="small" color="gray" />}
          <Text className="text-base font-medium text-foreground">
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Text>
        </Pressable>
      </View>
    );
  }, [handleLoadMore, hasNextPage, isFetchingNextPage]);

  return (
    <View className="flex-1">
      {/* Subtle syncing indicator for background syncs (native only) */}
      {Platform.OS !== 'web' && isSyncing && (
        <View className="flex-row items-center justify-center gap-2 py-2">
          <View className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <Text className="text-sm text-muted-foreground">
            {isSyncStale ? 'Syncing your transaction history...' : 'Syncing...'}
          </Text>
        </View>
      )}

      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // NOTE: no onEndReached — FlashList fires it on every re-render while the
        // content doesn't fill the viewport, which fetched every page at once
        // (Sentry: "10+ renders/second"). The footer button pages instead.
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        ItemSeparatorComponent={ItemSeparator}
        contentContainerStyle={{ paddingVertical: 0, paddingBottom: 100 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isLoading || isSyncing}
              onRefresh={onRefresh}
              tintColor="#666"
              colors={['#666']}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
