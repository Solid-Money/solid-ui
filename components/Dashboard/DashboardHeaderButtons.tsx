import { View } from 'react-native';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import HomeWithdraw from '@/assets/images/withdraw';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import SendModal from '@/components/Send/SendModal';
import SwapModal from '@/components/Swap/SwapModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import UnstakeModal from '@/components/Unstake/UnstakeModal';
import WithdrawModal from '@/components/Withdraw/WithdrawModal';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

type DashboardHeaderButtonsProps = {
  deposit?: {
    title: string;
  };
  withdraw?: {
    isWithdraw: boolean;
  };
  hideWithdraw?: boolean;
};

const DashboardHeaderButtons = ({ deposit, withdraw, hideWithdraw }: DashboardHeaderButtonsProps) => {
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
      {!hideWithdraw && (
        <>
          {withdraw?.isWithdraw ? (
            <WithdrawModal trigger={withdrawTrigger} />
          ) : (
            <UnstakeModal trigger={withdrawTrigger} />
          )}
        </>
      )}

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
          <Button
            variant="secondary"
            className="h-12 rounded-xl border-0 bg-[#303030] px-6"
            onPress={() => {
              track(TRACKING_EVENTS.NAVIGATION_BUTTON_CLICKED, {
                button_name: 'send',
                source: 'dashboard_header',
              });
            }}
          >
            <View className="flex-row items-center gap-2">
              <HomeSend />
              <Text className="text-base font-bold text-white">Send</Text>
            </View>
          </Button>
        }
      />

      <DepositOptionModal buttonText={deposit?.title || 'Add funds'} />
    </View>
  );
};

export default DashboardHeaderButtons;
