import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { getColorForTransaction, getInitials } from '@/lib/utils/cardHelpers';

interface MerchantBadgeProps {
  name: string;
  /** Diameter in points. The initials scale with it. */
  size?: number;
}

/**
 * The merchant's initials in a coloured disc — the same badge the card
 * transactions list uses, so a payment waiting on approval looks like the
 * payment it will become. The colour is derived from the name, so the same
 * merchant is the same colour everywhere without a lookup.
 */
const MerchantBadge = ({ name, size = 34 }: MerchantBadgeProps) => {
  const color = getColorForTransaction(name);

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size, backgroundColor: color.bg }}
    >
      <Text
        className="font-semibold"
        style={{ color: color.text, fontSize: Math.round(size * 0.42) }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
};

export default MerchantBadge;
