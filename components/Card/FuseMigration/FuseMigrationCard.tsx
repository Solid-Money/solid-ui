import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';

interface FuseMigrationCardProps {
  movableUsd: number;
  onPress: () => void;
}

const formatUsd = (usd: number) =>
  `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The card pane's standing "Move to Base" row, for as long as a spendable balance sits on Fuse.
 * The one-time popup points here; this opens the same token list.
 *
 * Laid out as `EnableCardSpendingCard`: a 23px card, 17px side inset, copy left and action right.
 */
const FuseMigrationCard = ({ movableUsd, onPress }: FuseMigrationCardProps) => (
  <View className="overflow-hidden rounded-[23px] bg-card" style={styles.row}>
    <View style={styles.label}>
      <Text className="text-[18px] font-medium leading-[25px] text-white">
        {formatUsd(movableUsd)} on Fuse
      </Text>
      <Text className="text-[14px] leading-[18px] text-muted-foreground">
        Move it to Base, where your card spends. No fees.
      </Text>
    </View>
    <Pressable
      accessibilityLabel="Move to Base"
      accessibilityRole="button"
      className="bg-white transition-all active:scale-95 active:opacity-80"
      onPress={onPress}
      style={styles.button}
    >
      <Text className="text-[16px] font-semibold text-black">Move</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: 17,
    paddingVertical: 12,
  },
  label: { flex: 1, gap: 2, paddingRight: 12 },
  button: {
    alignItems: 'center',
    borderRadius: 100,
    height: 35,
    justifyContent: 'center',
    minWidth: 84,
    paddingHorizontal: 12,
  },
});

export default FuseMigrationCard;
