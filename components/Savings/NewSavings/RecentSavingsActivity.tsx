import { Pressable, View } from 'react-native';
import { router } from 'expo-router';

import Transaction from '@/components/Transaction';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { isSavingsVaultActivity } from '@/constants/transaction';
import { useActivity } from '@/hooks/useActivity';

const MAX_ITEMS = 4;

/**
 * "Recent activity" for the funded savings screen — the most recent deposits
 * into and withdrawals out of the savings vault, with a "See all activity" link
 * to the full Activity screen. Card funding, wallet transfers and everything
 * else stay on their own surfaces. Renders nothing when there is no savings
 * activity.
 */
const RecentSavingsActivity = () => {
  const { activities, isLoading } = useActivity();

  const savings = (activities ?? []).filter(isSavingsVaultActivity).slice(0, MAX_ITEMS);

  if (isLoading || savings.length === 0) return null;

  return (
    <View className="gap-3 px-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-muted-foreground">Recent activity</Text>
        <Pressable
          onPress={() => router.push(path.ACTIVITY)}
          className="transition-all active:opacity-70"
        >
          <Text className="text-sm font-medium text-white">See all</Text>
        </Pressable>
      </View>

      <View className="overflow-hidden rounded-twice bg-card">
        {savings.map((activity, index) => (
          <Transaction
            key={activity.clientTxId}
            {...activity}
            showTimestamp
            isFirst={index === 0}
            isLast={index === savings.length - 1}
            onPress={() => router.push(`/activity/${activity.clientTxId}`)}
          />
        ))}
      </View>
    </View>
  );
};

export default RecentSavingsActivity;
