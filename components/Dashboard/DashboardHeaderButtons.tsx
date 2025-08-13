import { View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { DepositOptionModal } from '@/components/DepositOption';
import { path } from '@/constants/path';

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
          <Button
            variant="secondary"
            className="h-12 px-6 rounded-xl bg-[#303030] border-0"
            onPress={() => {
              router.push(path.SWAP);
            }}
          >
            <View className="flex-row items-center gap-2">
              <HomeSwap />
              <Text className="text-base text-white font-bold">Swap</Text>
            </View>
          </Button>
          <Button
            variant="secondary"
            className="h-12 px-6 rounded-xl bg-[#303030] border-0"
            onPress={() => {
              router.push(path.SEND);
            }}
          >
            <View className="flex-row items-center gap-2">
              <HomeSend />
              <Text className="text-base text-white font-bold">Send</Text>
            </View>
          </Button>
        </>
      )}
    </View>
  );
};

export default DashboardHeaderButtons;
