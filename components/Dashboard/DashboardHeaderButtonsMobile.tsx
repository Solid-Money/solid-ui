import { useRouter } from 'expo-router';
import { View } from 'react-native';

import HomeFund from '@/assets/images/home-fund';
import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import CircleButton from '@/components/CircleButton';
import { path } from '@/constants/path';

const DashboardHeaderButtonsMobile = () => {
  const router = useRouter();
  return (
    <View className="flex-row justify-center gap-12 items-center">
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

      <CircleButton
        icon={HomeSend}
        label="Send"
        onPress={() => router.push(path.SEND)}
        scale={0.9}
        viewBox="0 0 25 24"
      />

      <CircleButton
        icon={HomeSwap}
        label="Swap"
        onPress={() => router.push(path.SWAP)}
        scale={1}
        viewBox="0 0 29 28"
      />
    </View>
  );
};

export default DashboardHeaderButtonsMobile;
