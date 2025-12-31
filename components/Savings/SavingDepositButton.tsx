import { View } from 'react-native';
import { Plus } from 'lucide-react-native';

import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

const SavingDepositButton = () => {
  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'indigo',
          className: 'h-[3.375rem] rounded-xl pr-6',
        })}
      >
        <View className="flex-row items-center gap-2">
          <Plus color="white" />
          <Text className="text-lg font-bold">Make your first deposit</Text>
        </View>
      </View>
    );
  };

  return <DepositOptionModal trigger={getTrigger()} />;
};

export default SavingDepositButton;
