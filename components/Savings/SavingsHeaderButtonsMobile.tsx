import { Minus, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import CircleButton from '@/components/CircleButton';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import UnstakeModal from '@/components/Unstake/UnstakeModal';
import { Text } from '@/components/ui/text';

interface TriggerProps {
  icon: React.ReactNode;
  label: string;
  props?: any;
}

const Trigger = ({ icon, label, ...props }: TriggerProps) => {
  return (
    <Pressable className="items-center gap-1.5" {...props}>
      <View className="bg-muted rounded-full p-4">{icon}</View>
      <Text className="text-sm text-white font-semibold">{label}</Text>
    </Pressable>
  );
};

const SavingsHeaderButtonsMobile = () => {
  return (
    <View className="flex-row justify-between gap-8 items-center mx-auto">
      <DepositOptionModal
        trigger={
          <CircleButton
            icon={Plus}
            label="Fund"
            backgroundColor="bg-[#94F27F]"
            iconColor="#000000"
          />
        }
      />

      <UnstakeModal trigger={<Trigger icon={<Minus color="white" />} label="Withdraw" />} />
    </View>
  );
};

export default SavingsHeaderButtonsMobile;
