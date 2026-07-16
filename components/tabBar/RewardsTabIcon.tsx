import { View } from 'react-native';
import { Star } from 'lucide-react-native';

interface RewardsTabIconProps {
  /** The tab-bar icon slot size (matches the other tabs' Lottie icons). */
  size: number;
  /** Tint from the tab bar (white), keeping it consistent with the other tabs. */
  color: string;
}

/**
 * Rewards tab icon. Uses the white lucide Star (the tier icons are only available
 * in yellow, which would clash with the white Wallet/Savings tab icons). The star
 * is centered in a full `size` box so its baseline — and its icon↔label gap —
 * matches the other (Lottie) tab icons.
 */
const RewardsTabIcon = ({ size, color }: RewardsTabIconProps) => {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Star size={Math.round(size * 0.7)} color={color} />
    </View>
  );
};

export default RewardsTabIcon;
