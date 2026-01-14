import { View } from 'react-native';
import { Plus } from 'lucide-react-native';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import HomeWithdraw from '@/assets/images/withdraw';
import CircleButton from '@/components/CircleButton';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import SendModal from '@/components/Send/SendModal';
import SwapModal from '@/components/Swap/SwapModal';
import UnstakeModal from '@/components/Unstake/UnstakeModal';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

const SavingsHeaderButtonsMobile = () => {
  const withdrawTrigger = (
    <CircleButton
      icon={HomeWithdraw}
      label="Withdraw"
      onPress={() => {
        track(TRACKING_EVENTS.NAVIGATION_BUTTON_CLICKED, {
          button_name: 'withdraw',
          source: 'savings_mobile',
        });
      }}
      scale={1.1}
      viewBox="0 0 14 14"
    />
  );

  return (
    <View className="flex-row items-center justify-center gap-8">
      <DepositOptionModal
        trigger={
          <CircleButton
            icon={Plus}
            label="Fund"
            backgroundColor="bg-[#94F27F]"
            iconColor="#000000"
          />
        }
      />

      <UnstakeModal trigger={withdrawTrigger} />

      <SwapModal
        trigger={<CircleButton icon={HomeSwap} label="Swap" scale={1} viewBox="0 0 29 28" />}
      />

      <SendModal
        trigger={<CircleButton icon={HomeSend} label="Send" scale={0.9} viewBox="0 0 25 24" />}
      />
    </View>
  );
};

export default SavingsHeaderButtonsMobile;
