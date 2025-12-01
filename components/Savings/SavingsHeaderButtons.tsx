import { View } from 'react-native';

import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import UnstakeModal from '@/components/Unstake/UnstakeModal';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

import HomeWithdraw from '@/assets/images/withdraw';

type SavingsHeaderButtonsProps = {
  hasTokens: boolean;
};

const SavingsHeaderButtons = ({ hasTokens }: SavingsHeaderButtonsProps) => {
  const withdrawTrigger = (
    <Button
      variant="secondary"
      className="h-12 px-6 rounded-xl bg-[#303030] border-0"
      onPress={() => {
        track(TRACKING_EVENTS.NAVIGATION_BUTTON_CLICKED, {
          button_name: 'withdraw',
          source: 'dashboard_header',
        });
      }}
    >
      <View className="flex-row items-center gap-2">
        <HomeWithdraw />
        <Text className="text-base text-white font-bold">Withdraw</Text>
      </View>
    </Button>
  );

  return (
    <View className="flex-row gap-2">
      <DepositOptionModal buttonText="Add funds" />
      {hasTokens && <UnstakeModal trigger={withdrawTrigger} />}
    </View>
  );
};

export default SavingsHeaderButtons;
