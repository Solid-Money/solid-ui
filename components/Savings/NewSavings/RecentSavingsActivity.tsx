import { Pressable, View } from 'react-native';
import { router } from 'expo-router';

import Transaction from '@/components/Transaction';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getTransactionCategory } from '@/constants/transaction';
import { useActivity } from '@/hooks/useActivity';
import { ActivityEvent, TransactionCategory } from '@/lib/types';

// soUSD / soFUSE / soETH — the three savings vault tokens.
const SAVINGS_SYMBOLS = new Set(['sousd', 'sofuse', 'soeth']);
const MAX_ITEMS = 4;

/** Keep only savings-related activity (by category or by vault-token symbol). */
const isSavingsActivity = (activity: ActivityEvent) =>
  getTransactionCategory(activity.type, activity.title) === TransactionCategory.SAVINGS_ACCOUNT ||
  SAVINGS_SYMBOLS.has((activity.symbol ?? '').toLowerCase());

/**
 * "Recent activity" for the funded savings screen — the most recent
 * savings-related transactions, with a "See all activity" link to the full
 * Activity screen. Renders nothing when there are no savings activities.
 */
const RecentSavingsActivity = () => {
  const { activities, isLoading } = useActivity();

  const savings = (activities ?? []).filter(isSavingsActivity).slice(0, MAX_ITEMS);

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
