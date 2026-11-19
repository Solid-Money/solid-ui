import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AssetLogo } from '@/components/Card/NewCardDetails/SpendMode/SpendModePanels';
import {
  type ReorderableItemState,
  ReorderableList,
} from '@/components/Card/OrderList/ReorderableList';
import { Text } from '@/components/ui/text';

import { DIVIDER, type SpendOrderRow } from './spendOrderRows';

import type { SpendAssetKey } from '@/lib/utils/spendOrder';

/** Figma 30971:15193: every asset row is 64pt. */
const ROW_HEIGHT = 64;
/** Figma 30971:15292: "Your card won’t use", 14 above and 8 below an 18pt line. */
const DIVIDER_HEIGHT = 40;

/** Figma 30971:15292: the label, then a hairline to the panel's edge. */
const SpendOrderDivider = () => (
  <View style={styles.divider}>
    <Text className="text-[14px] font-normal leading-[18px] text-white/50">
      Your card won’t use
    </Text>
    <View style={styles.dividerLine} />
  </View>
);

interface SpendOrderListProps {
  /** The visible order: spent assets, {@link DIVIDER}, then the excluded ones. */
  slots: string[];
  rows: ReadonlyMap<SpendAssetKey, SpendOrderRow>;
  onChange: (slots: string[]) => void;
}

/**
 * The Order panel (Figma 30971:15192): the assets the card spends, ranked, over "Your card won’t
 * use" and the ones it never touches. Drag a row by its handle, or hold it anywhere and drag;
 * below the divider keeps it out, above brings it back. Screen readers get Move up / Move down
 * actions, with "Use" and "Don’t use" for the ones that cross the divider.
 */
const SpendOrderList = ({ slots, rows, onChange }: SpendOrderListProps) => {
  const divider = useMemo(
    () => ({
      key: DIVIDER,
      height: DIVIDER_HEIGHT,
      render: () => <SpendOrderDivider />,
      upLabel: 'Use',
      downLabel: 'Don’t use',
    }),
    [],
  );

  const renderItem = useCallback(
    (key: string, { rank, excluded }: ReorderableItemState) => {
      const row = rows.get(key as SpendAssetKey);
      if (!row) return null;
      const subtitle = excluded ? 'Drag up to spend it' : row.subtitle;
      return (
        <>
          {/* No rank below the divider; the column holds, so the logos stay in line. */}
          <Text className="w-[14px] text-center text-[14px] font-medium leading-[18px] text-white/50">
            {rank ?? ''}
          </Text>
          <AssetLogo icon={row.icon} />
          <View style={styles.left}>
            <Text numberOfLines={1} className="text-[16px] font-medium leading-[20px] text-white">
              {row.name}
            </Text>
            {subtitle ? (
              <Text
                numberOfLines={1}
                className="text-[14px] font-normal leading-[18px] text-white/50"
              >
                {subtitle}
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
    (key: string, { rank, excluded }: ReorderableItemState) => {
      const row = rows.get(key as SpendAssetKey);
      if (!row) return key;
      return excluded
        ? `${row.name}, ${row.value}, not used by your card`
        : `${rank}. ${row.name}, ${row.value}`;
    },
    [rows],
  );

  // Only rows the screen can draw: a key the backend sends that this build has no row for stays
  // out of the list (and keeps its place in the saved order).
  const data = useMemo(
    () => slots.filter(slot => slot === DIVIDER || rows.has(slot as SpendAssetKey)),
    [rows, slots],
  );

  return (
    <ReorderableList
      data={data}
      onReorder={onChange}
      renderItem={renderItem}
      getItemAccessibilityLabel={accessibilityLabel}
      itemHeight={ROW_HEIGHT}
      divider={divider}
    />
  );
};

const styles = StyleSheet.create({
  left: { flex: 1, gap: 2, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 2 },
  // Figma: 14 above, 8 below, 20 in from either side; the line takes the rest of the row.
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    height: DIVIDER_HEIGHT,
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  dividerLine: { backgroundColor: 'rgba(255, 255, 255, 0.1)', flex: 1, height: 1 },
});

export default SpendOrderList;
