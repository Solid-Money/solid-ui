import { View } from 'react-native';

import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import SendModal from '@/components/Send/SendModal';
import SwapModal from '@/components/Swap/SwapModal';
import { Button, buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import UnstakeModal from '@/components/Unstake/UnstakeModal';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import HomeWithdraw from '@/assets/images/withdraw';

const DashboardHeaderButtons = () => {
  const withdrawTrigger = (
    <Button
      variant="secondary"
      className="h-12 rounded-xl border-0 bg-[#303030] px-6"
      onPress={() => {
        track(TRACKING_EVENTS.NAVIGATION_BUTTON_CLICKED, {
          button_name: 'withdraw',
          source: 'dashboard_header',
        });
      }}
    >
      <View className="flex-row items-center gap-2">
        <HomeWithdraw />
        <Text className="text-base font-bold text-white">Withdraw</Text>
      </View>
    </Button>
  );

  return (
    <View className="flex-row gap-2">
      <UnstakeModal trigger={withdrawTrigger} />

      <SwapModal
        trigger={
          <Button
            variant="secondary"
            className="h-12 rounded-xl border-0 bg-[#303030] px-6"
            onPress={() => {
              track(TRACKING_EVENTS.NAVIGATION_BUTTON_CLICKED, {
                button_name: 'swap',
                source: 'dashboard_header',
              });
            }}
          >
            <View className="flex-row items-center gap-2">
              <HomeSwap />
              <Text className="text-base font-bold text-white">Swap</Text>
            </View>
          </Button>
        }
      />

      <SendModal
        trigger={
          <View
            className={buttonVariants({
              variant: 'secondary',
              className: 'h-12 rounded-xl border-0 bg-[#303030] px-6',
            })}
          >
            <View className="flex-row items-center gap-2">
              <HomeSend />
              <Text className="text-base font-bold text-white">Send</Text>
            </View>
          </View>
        }
      />

      <DepositOptionModal buttonText="Add funds" />
    </View>
  );
};

export default DashboardHeaderButtons;
