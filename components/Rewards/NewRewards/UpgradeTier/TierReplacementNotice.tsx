import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatRenewsAt, formatReplacementNotice } from '@/lib/tierUpgrade';

import type { TierOffer } from '@/lib/types';

/**
 * What buying this tier does to the membership the user already pays for.
 *
 * Shown on the offer and the review, before the signature, because the one
 * thing an upgrading member cannot work out from the price is that the months
 * left on their current tier end today and are not paid back. Draws nothing
 * for an offer that replaces no membership.
 */
const TierReplacementNotice = ({ offer }: { offer: TierOffer }) => {
  const notice = formatReplacementNotice(offer);
  if (!notice) return null;

  return (
    <View className="mt-4 rounded-[20px] bg-[#1C1C1C] px-5 py-4">
      <Text className="text-[15px] leading-5 text-white">{notice}</Text>
      <Text className="mt-1 text-[14px] leading-5 text-white/50">{formatRenewsAt(offer)}</Text>
    </View>
  );
};

export default TierReplacementNotice;
