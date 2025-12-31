import { View } from 'react-native';

import HomeFund from '@/assets/images/home-fund';
import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import CircleButton from '@/components/CircleButton';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import SendModal from '@/components/Send/SendModal';
import SwapModal from '@/components/Swap/SwapModal';

const DashboardHeaderButtonsMobile = () => {
  return (
    <View className="flex-row items-center justify-center gap-12">
      <DepositOptionModal
        trigger={
          <CircleButton
            icon={HomeFund}
            label="Fund"
            backgroundColor="bg-[#94F27F]"
            iconColor="#000000"
            viewBox="0 0 20 20"
            scale={1}
          />
        }
      />

      <SwapModal
        trigger={<CircleButton icon={HomeSwap} label="Swap" scale={1} viewBox="0 0 29 28" />}
      />

      <SendModal
        trigger={<CircleButton icon={HomeSend} label="Send" scale={0.9} viewBox="0 0 25 24" />}
      />
    </View>
  );
};

export default DashboardHeaderButtonsMobile;
