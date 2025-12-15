import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';

import HomeWithdraw from '@/assets/images/withdraw';
import CircleButton from '@/components/CircleButton';
import UnstakeModal from '@/components/Unstake/UnstakeModal';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

const SavingsHeaderButtonsMobile = () => {
  const router = useRouter();

  const withdrawTrigger = (
    <CircleButton
      icon={HomeWithdraw}
      label="Withdraw"
      onPress={() => {
        track(TRACKING_EVENTS.NAVIGATION_BUTTON_CLICKED, {
          button_name: 'withdraw',
          source: 'savings_mobile',
        });
      }}
      scale={0.9}
      viewBox="0 0 20 16"
    />
  );

  return (
    <View className="flex-row justify-center gap-12 items-center">
      <CircleButton
        icon={Plus}
        label="Fund"
        backgroundColor="bg-[#94F27F]"
        iconColor="#000000"
        onPress={() => router.push(path.DEPOSIT)}
      />

      <UnstakeModal trigger={withdrawTrigger} />
    </View>
  );
};

export default SavingsHeaderButtonsMobile;
