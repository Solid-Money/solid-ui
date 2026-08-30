import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';

import UnifiedActivityRow, {
  useUnifiedActivityPress,
} from '@/components/Activity/UnifiedActivityRow';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCashbacks } from '@/hooks/useCashbacks';
import { useUnifiedActivity } from '@/hooks/useUnifiedActivity';
import { ActivityTab } from '@/lib/types';

/** Figma 24781:8017 shows three rows — enough to recognise, short enough to skim. */
const RECENT_ACTIVITY_LIMIT = 3;

/**
 * "Recent activity" on the wallet screen (Figma 24766:1831).
 *
 * Wallet and card rows are mixed, newest first, exactly as the Activity screen
 * shows them — "See all" is the same list without the cut-off, not a different
 * view of it. The section hides itself entirely when the account has no history,
 * so a new wallet is not given an empty box to look at.
 */
export default function HomeRecentActivity() {
  const { items, isLoading, userHasCard } = useUnifiedActivity();
  const { data: cashbacks } = useCashbacks({ enabled: userHasCard });
  const { provider } = useCardProvider();
  const handlePress = useUnifiedActivityPress(ActivityTab.ALL);

  const recentItems = useMemo(() => items.slice(0, RECENT_ACTIVITY_LIMIT), [items]);

  if (!recentItems.length) {
    if (!isLoading) return null;
    return (
      <View className="mt-5 gap-3 px-4">
        <Text className="text-base font-normal text-white/50">Recent activity</Text>
        <Skeleton className="h-[181px] w-full rounded-[20px] bg-card" />
      </View>
    );
  }

  return (
    <View className="mt-5 gap-3 px-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-normal text-white/50">Recent activity</Text>
        <Pressable
          accessibilityLabel="See all activity"
          accessibilityRole="button"
          onPress={() => router.push(path.ACTIVITY)}
          className="rounded-full bg-card px-[14px] py-[4px] active:opacity-80 web:hover:bg-card-hover"
        >
          <Text className="text-sm font-medium text-white/70">See all</Text>
        </Pressable>
      </View>

      <View className="overflow-hidden rounded-[20px]">
        {recentItems.map((item, index) => (
          <UnifiedActivityRow
            key={item.id}
            item={item}
            cashbacks={cashbacks}
            provider={provider}
            isFirst={index === 0}
            isLast={index === recentItems.length - 1}
            onPress={handlePress}
          />
        ))}
      </View>
    </View>
  );
}
