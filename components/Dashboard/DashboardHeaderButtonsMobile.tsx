import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';

import { path } from '@/constants/path';
import CircleButton from '@/components/CircleButton';
import ResponsiveDepositOptionModal from '@/components/DepositOption/ResponsiveDepositOptionModal';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';

const DashboardHeaderButtonsMobile = () => {
  const router = useRouter();
  return (
    <View className="flex-row justify-between gap-8 items-center mx-auto">
      <ResponsiveDepositOptionModal
        trigger={
          <CircleButton
            icon={Plus}
            label="Fund"
            backgroundColor="bg-[#94F27F]"
            iconColor="#000000"
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
