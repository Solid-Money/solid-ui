import { View } from 'react-native';

import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import SendModal from '@/components/Send/SendModal';
import SwapModal from '@/components/Swap/SwapModal';
import { Button, buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';

type DashboardHeaderButtonsProps = {
  hasTokens: boolean;
};

const DashboardHeaderButtons = ({ hasTokens }: DashboardHeaderButtonsProps) => {
  return (
    <View className="flex-row gap-2">
      <DepositOptionModal buttonText="Add funds" />

      {hasTokens && (
        <>
          <SendModal
            trigger={
              <View
                className={buttonVariants({
                  variant: 'secondary',
                  className: 'h-12 px-6 rounded-xl bg-[#303030] border-0',
                })}
              >
                <View className="flex-row items-center gap-2">
                  <HomeSend />
                  <Text className="text-base text-white font-bold">Send</Text>
                </View>
              </View>
            }
          />

          <SwapModal
            trigger={
              <Button
                variant="secondary"
                className="h-12 px-6 rounded-xl bg-[#303030] border-0"
                onPress={() => {
                  track(TRACKING_EVENTS.NAVIGATION_BUTTON_CLICKED, {
                    button_name: 'swap',
                    source: 'dashboard_header',
                  });
                }}
              >
                <View className="flex-row items-center gap-2">
                  <HomeSwap />
                  <Text className="text-base text-white font-bold">Swap</Text>
                </View>
              </Button>
            }
          />
        </>
      )}
    </View>
  );
};

export default DashboardHeaderButtons;
