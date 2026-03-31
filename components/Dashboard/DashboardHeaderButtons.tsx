import { Linking, View } from 'react-native';

import FuseLogoSkeleton from '@/assets/images/fuse-logo-skeleton';
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
  hideSend?: boolean;
  hideSwap?: boolean;
  showBuyFuse?: boolean;
  disableWithdraw?: boolean;
  disableSend?: boolean;
  disableSwap?: boolean;
  preserveSelectedVault?: boolean;
};

const DashboardHeaderButtons = ({
  deposit,
  withdraw,
  hideWithdraw,
  hideSend,
  hideSwap,
  showBuyFuse = false,
  disableWithdraw,
  disableSend,
  disableSwap,
  preserveSelectedVault,
}: DashboardHeaderButtonsProps) => {
  const withdrawTrigger = (
    <Button
      variant="secondary"
      className="h-12 rounded-xl border-0 bg-[#303030] px-6"
      disabled={disableWithdraw}
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
      {showBuyFuse && (
        <Button
          variant="secondary"
          className="h-12 rounded-xl border-0 bg-[#303030] px-6"
          onPress={() => {
            track(TRACKING_EVENTS.NAVIGATION_BUTTON_CLICKED, {
              button_name: 'buy_fuse',
              source: 'dashboard_header',
            });
            Linking.openURL('https://www.fuse.io/get-fuse');
          }}
        >
          <View className="flex-row items-center gap-2">
            <FuseLogoSkeleton />
            <Text className="text-base font-bold text-white">Buy Fuse</Text>
          </View>
        </Button>
      )}
      {!hideWithdraw && (
        <>
          {withdraw?.isWithdraw ? (
            <WithdrawModal trigger={withdrawTrigger} />
          ) : (
            <UnstakeModal trigger={withdrawTrigger} />
          )}
        </>
      )}

      {!hideSwap && (
        <SwapModal
          trigger={
            <Button
              variant="secondary"
              className="h-12 rounded-xl border-0 bg-[#303030] px-6"
              disabled={disableSwap}
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
      )}

      {!hideSend && (
        <SendModal
          trigger={
            <Button
              variant="secondary"
              className="h-12 rounded-xl border-0 bg-[#303030] px-6"
              disabled={disableSend}
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
      )}

      <DepositOptionModal
        buttonText={deposit?.title || 'Add funds'}
        preserveSelectedVault={preserveSelectedVault}
      />
    </View>
  );
};

export default DashboardHeaderButtons;
