import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  RewardsRowIcon,
  RowChevronIcon,
  SupportRowIcon,
  TransactionsRowIcon,
} from '@/components/Card/NewCardDetails/icons';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

interface LinkRowProps {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}

const LinkRow = ({ icon, label, onPress }: LinkRowProps) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={styles.row}
    className="flex-row items-center web:hover:bg-card-hover"
  >
    <View style={styles.iconSlot}>{icon}</View>
    <Text className="flex-1 text-[16px] font-medium text-white">{label}</Text>
    <RowChevronIcon />
  </Pressable>
);

/**
 * View transactions / Rewards & details / Contact support list (Figma 21843:1203):
 * three equal rows in one #1C1C1C card, separated by white/10 hairlines.
 */
const CardLinksList = () => {
  const router = useRouter();

  return (
    <View className="overflow-hidden rounded-twice bg-card">
      <LinkRow
        icon={<TransactionsRowIcon />}
        label="View transactions"
        onPress={() => router.push('/activity?tab=card')}
      />
      <View style={styles.divider} />
      <LinkRow
        icon={<RewardsRowIcon />}
        label="Rewards & details"
        onPress={() => router.push(path.REWARDS_BENEFITS)}
      />
      <View style={styles.divider} />
      <LinkRow icon={<SupportRowIcon />} label="Contact support" onPress={openSupportDrawer} />
    </View>
  );
};

const styles = StyleSheet.create({
  // Figma rows are ~73.7pt tall with the label at x=66 and the chevron 24 from the
  // right edge; a 24pt icon slot centred at x≈38 puts the label exactly at 66.
  row: { paddingLeft: 26, paddingRight: 24, paddingVertical: 25 },
  iconSlot: { alignItems: 'center', marginRight: 16, width: 24 },
  divider: { backgroundColor: 'rgba(255, 255, 255, 0.1)', height: 1 },
});

export default CardLinksList;
