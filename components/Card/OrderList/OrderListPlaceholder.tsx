import { Pressable, StyleSheet, View } from 'react-native';

import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

export type OrderListPlaceholderProps =
  /** Rows still to come: the saved order, or what the card holds. */
  | { kind: 'loading' }
  /** The saved order could not be read, so there is nothing safe to edit yet. */
  | { kind: 'failed'; message: string; onRetry: () => void }
  /** Nothing to order. */
  | { kind: 'empty'; message: string };

/**
 * What an order screen shows in the list's panel while it has no list to drag: three skeleton
 * rows while it loads, the failed read with a retry, or a line saying there is nothing to order.
 */
const OrderListPlaceholder = (props: OrderListPlaceholderProps) => {
  if (props.kind === 'loading') {
    return (
      <View style={styles.panel}>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text className="text-[14px] font-normal leading-[18px] text-white/50">{props.message}</Text>
      {props.kind === 'failed' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try loading again"
          className="active:opacity-80"
          hitSlop={8}
          onPress={props.onRetry}
          style={styles.retry}
        >
          <Text className="text-[14px] font-semibold leading-[18px] text-white">Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  // The list panel's look while there are no rows to drag.
  panel: { backgroundColor: '#2B2B2B', borderRadius: 20, gap: 12, padding: 20 },
  retry: { alignSelf: 'flex-start' },
});

export default OrderListPlaceholder;
