import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';

import HomeCard from '@/assets/images/home-card';
import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import { path } from '@/constants/path';
import CircleButton from '../CircleButton';
import SavingCountUp from '../SavingCountUp';
import { Text } from '../ui/text';

interface DashboardHeaderMobileProps {
  balance: number;
  totalAPY: number;
  lastTimestamp: number;
  principal?: number;
}

const DashboardHeaderMobile = ({
  balance,
  totalAPY,
  lastTimestamp,
  principal,
}: DashboardHeaderMobileProps) => {
  const router = useRouter();

  return (
    <View className="gap-10 mt-10">
      <View className="flex-row justify-center items-center">
        <Text className="text-7xl font-semibold mt-2.5">$</Text>
        <SavingCountUp
          balance={balance ?? 0}
          apy={totalAPY ?? 0}
          lastTimestamp={lastTimestamp ?? 0}
          principal={principal}
          classNames={{
            wrapper: 'text-foreground',
            decimalSeparator: 'text-2xl font-medium',
          }}
          styles={{
            wholeText: {
              fontSize: 60,
              fontWeight: '600',
              color: '#ffffff',
            },
            decimalText: {
              fontSize: 24,
              fontWeight: '500',
              color: '#ffffff',
            },
          }}
        />
      </View>

      <View className="flex-row justify-around px-2 items-center w-full  mx-auto">
        <CircleButton
          icon={Plus}
          label="Fund"
          onPress={() => router.push(path.DEPOSIT)}
          backgroundColor="bg-[#94F27F]"
          iconColor="#000000"
        />

        <CircleButton
          icon={HomeSend}
          label="Send"
          onPress={() => router.push(path.SEND)}
          scale={0.9}
          viewBox="0 0 25 24"
        />

        <CircleButton
          icon={HomeCard}
          label="Card"
          onPress={() => router.push(path.CARD)}
          scale={1}
          viewBox="0 0 25 21"
        />

        <CircleButton
          icon={HomeSwap}
          label="Swap"
          onPress={() => router.push(path.SWAP)}
          scale={1}
          viewBox="0 0 29 28"
        />
      </View>
    </View>
  );
};

export default DashboardHeaderMobile;
