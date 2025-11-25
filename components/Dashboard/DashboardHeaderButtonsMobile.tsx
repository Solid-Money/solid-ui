import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import CircleButton from '@/components/CircleButton';
import { path } from '@/constants/path';

const DashboardHeaderButtonsMobile = () => {
  const router = useRouter();
  return (
    <View className="flex-row justify-center gap-12 items-center">
      <CircleButton
        icon={Plus}
        label="Fund"
        backgroundColor="bg-[#94F27F]"
        iconColor="#000000"
        onPress={() => router.push(path.DEPOSIT)}
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
