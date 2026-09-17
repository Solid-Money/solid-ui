import { Pressable, StyleSheet, View } from 'react-native';

import { InlineChevronIcon } from '@/components/Card/NewCardDetails/icons';
import {
  SPEND_MODE_COPY,
  type SpendMode,
} from '@/components/Card/NewCardDetails/SpendMode/spendModes';
import { Text } from '@/components/ui/text';

interface SpendingModeCardProps {
  /** The mode the card is spending in today. */
  mode?: SpendMode;
  onChangeMode: () => void;
}

/**
 * "Spend mode › … Credit [Change]" (Figma 26134:24137), the row between the
 * action icons and the borrow position.
 *
 * The chevron beside the label is drawn but inert: the design puts an
 * explanation behind it that hasn't been written yet.
 *
 * The mode it names is read from whichever spend module operates the Safe, and is
 * `cash` for every cardholder still on v1 — which is all of them at launch. The
 * card screen only renders this row once the other modes are actually reachable,
 * so it never offers a change it cannot make.
 */
const SpendingModeCard = ({ mode = 'cash', onChangeMode }: SpendingModeCardProps) => (
  <View className="overflow-hidden rounded-[23px] bg-card" style={styles.row}>
    <View style={styles.label}>
      <Text className="text-[18px] font-medium leading-[25px] text-white">Spend mode</Text>
      <InlineChevronIcon />
    </View>
    <View style={styles.value}>
      <Text className="text-[18px] font-medium leading-[25px] text-white">
        {SPEND_MODE_COPY[mode].label}
      </Text>
      <Pressable
        accessibilityLabel="Change spend mode"
        accessibilityRole="button"
        className="bg-white transition-all active:scale-95 active:opacity-80"
        onPress={onChangeMode}
        style={styles.button}
      >
        <Text className="text-[16px] font-semibold text-black">Change</Text>
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  // Figma 385 × 61, inset 17 either side, everything centred on the height.
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 61,
    justifyContent: 'space-between',
    paddingHorizontal: 17,
  },
  label: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  value: { alignItems: 'center', flexDirection: 'row', gap: 15 },
  button: {
    alignItems: 'center',
    borderRadius: 100,
    height: 35,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});

export default SpendingModeCard;
