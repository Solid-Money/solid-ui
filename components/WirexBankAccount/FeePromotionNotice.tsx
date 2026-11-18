import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { eurDepositPromotionCopy, UserFeePromotion } from '@/lib/utils/feePromotion';

/**
 * "Your next 2 SEPA deposits are free" on the euro account screen, while a fee
 * promotion is running and the user has free deposits left under it. Read
 * before the IBAN, so the user knows before they send money.
 */
export const FeePromotionNotice = ({ promotion }: { promotion: UserFeePromotion }) => {
  const { title, body } = eurDepositPromotionCopy(promotion);
  return (
    <View
      accessibilityRole="summary"
      className="mt-5 gap-1 rounded-twice border border-brand/30 bg-brand/10 px-5 py-4"
    >
      <Text className="text-[16px] font-semibold text-brand">{title}</Text>
      <Text className="text-sm leading-5 text-white/70">{body}</Text>
    </View>
  );
};
