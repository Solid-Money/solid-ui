import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { RewardsTier } from '@/lib/types';

const DEPOSIT_ICON = require('@/assets/images/rewards-upgrade-deposit.png');
const BUY_ICON = require('@/assets/images/rewards-upgrade-buy.png');

const UPGRADE_AMOUNT: Record<RewardsTier.PRIME | RewardsTier.ULTRA, string> = {
  [RewardsTier.PRIME]: '50K',
  [RewardsTier.ULTRA]: '400K',
};

const TIER_LABEL: Record<RewardsTier.PRIME | RewardsTier.ULTRA, string> = {
  [RewardsTier.PRIME]: 'Prime',
  [RewardsTier.ULTRA]: 'Ultra',
};

interface UpgradeTierSheetContentProps {
  tier: RewardsTier.PRIME | RewardsTier.ULTRA;
  onDepositFuse: () => void;
  onBuyFuse: () => void;
  topPadding?: number;
}

interface UpgradeActionRowProps {
  label: string;
  icon: number;
  onPress: () => void;
}

const UpgradeActionRow = ({ label, icon, onPress }: UpgradeActionRowProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    className="h-[79px] flex-row items-center px-[17px] transition-all active:opacity-70"
  >
    <Image source={icon} style={{ width: 52, height: 52 }} contentFit="contain" />
    <Text
      className="ml-[11px] flex-1 text-white"
      style={{
        fontFamily: 'MonaSans_600SemiBold',
        fontSize: 18,
        lineHeight: 22,
      }}
    >
      {label}
    </Text>
    <ChevronRight color="white" size={16} strokeWidth={2} />
  </Pressable>
);

const UpgradeTierSheetContent = ({
  tier,
  onDepositFuse,
  onBuyFuse,
  topPadding = 36,
}: UpgradeTierSheetContentProps) => {
  const tierLabel = TIER_LABEL[tier];

  return (
    <View className="items-center px-[33px]" style={{ paddingTop: topPadding }}>
      <Text
        className="text-center text-white"
        style={{
          fontFamily: 'MonaSans_500Medium',
          fontSize: 30,
          lineHeight: 36,
        }}
      >
        Upgrade to {tierLabel}
      </Text>
      <Text
        className="mt-[11px] w-[258px] text-center text-white/70"
        style={{
          fontFamily: 'MonaSans_400Regular',
          fontSize: 16,
          lineHeight: 18,
        }}
      >
        Deposit or buy {UPGRADE_AMOUNT[tier]} FUSE to upgrade to {tierLabel}
      </Text>

      <View className="mt-[44px] h-[158px] w-full max-w-[352px] overflow-hidden rounded-[20px] bg-[#2B2B2B]">
        <UpgradeActionRow label="Deposit FUSE" icon={DEPOSIT_ICON} onPress={onDepositFuse} />
        <View className="h-px bg-white/10" />
        <UpgradeActionRow label="Buy FUSE" icon={BUY_ICON} onPress={onBuyFuse} />
      </View>
    </View>
  );
};

export default UpgradeTierSheetContent;
