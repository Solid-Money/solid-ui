import { View } from 'react-native';

import { Text } from '@/components/ui/text';

/**
 * "Your SEPA deposits are free until 23 Dec" on the euro account screen, while
 * the user's KOL invite perk covers their deposits. Same look as the fee
 * promotion notice, and shown in its place: the perk is the user's own and is
 * used first.
 */
export const KolPerkNotice = ({ title, body }: { title: string; body: string }) => (
  <View
    accessibilityRole="summary"
    className="mt-5 gap-1 rounded-twice border border-brand/30 bg-brand/10 px-5 py-4"
  >
    <Text className="text-[16px] font-semibold text-brand">{title}</Text>
    <Text className="text-sm leading-5 text-white/70">{body}</Text>
  </View>
);
