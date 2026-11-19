import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CollateralLogo } from '@/components/Card/NewCardDetails/SpendMode/SpendModePanels';
import {
  type ReorderableItemState,
  ReorderableList,
} from '@/components/Card/OrderList/ReorderableList';
import { Text } from '@/components/ui/text';

import type { CollateralOrderRow } from './collateralOrderRows';
import type { CollateralAssetKey } from '@/lib/utils/collateralOrder';

/** The same 64pt rows as the Spend order list. */
const ROW_HEIGHT = 64;

interface CollateralOrderListProps {
  /** The listed keys, in the order the card locks them. */
  slots: readonly CollateralAssetKey[];
  rows: ReadonlyMap<CollateralAssetKey, CollateralOrderRow>;
  onChange: (slots: string[]) => void;
}

/**
 * The Order panel of the Collateral order screen: every collateral the card can lock, ranked, with
 * no divider — collateral is reordered, never left out. Drag a row by its handle, or hold it
 * anywhere and drag. Screen readers get Move up / Move down actions.
 */
const CollateralOrderList = ({ slots, rows, onChange }: CollateralOrderListProps) => {
  const renderItem = useCallback(
    (key: string, { rank }: ReorderableItemState) => {
      const row = rows.get(key as CollateralAssetKey);
      if (!row) return null;
      return (
        <>
          <Text className="w-[14px] text-center text-[14px] font-medium leading-[18px] text-white/50">
            {rank ?? ''}
          </Text>
          <CollateralLogo icon={row.icon} />
          <View style={styles.left}>
            <Text numberOfLines={1} className="text-[16px] font-medium leading-[20px] text-white">
              {row.name}
            </Text>
            {row.subtitle ? (
              <Text
                numberOfLines={1}
                className="text-[14px] font-normal leading-[18px] text-white/50"
              >
                {row.subtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.right}>
            <Text className="text-right text-[16px] font-medium leading-[20px] text-white">
              {row.value}
            </Text>
            {row.detail ? (
              <Text className="text-right text-[14px] font-normal leading-[18px] text-white/50">
                {row.detail}
              </Text>
            ) : null}
          </View>
        </>
      );
    },
    [rows],
  );

  const accessibilityLabel = useCallback(
    (key: string, { rank }: ReorderableItemState) => {
      const row = rows.get(key as CollateralAssetKey);
      if (!row) return key;
      return `${rank}. ${row.name}, ${row.value}`;
    },
    [rows],
  );

  // Only rows the screen can draw.
  const data = useMemo(() => slots.filter(slot => rows.has(slot)), [rows, slots]);

  return (
    <ReorderableList
      data={data}
      onReorder={onChange}
      renderItem={renderItem}
      getItemAccessibilityLabel={accessibilityLabel}
      itemHeight={ROW_HEIGHT}
    />
  );
};

const styles = StyleSheet.create({
  left: { flex: 1, gap: 2, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 2 },
});

export default CollateralOrderList;
