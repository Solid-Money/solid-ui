import { View } from 'react-native';
import { Plus } from 'lucide-react-native';

import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

const DepositButton = () => {
  const getTrigger = () => {
    return (
      <Button variant="brand" className="h-[3.375rem] rounded-xl pr-6 md:w-72">
        <View className="flex-row items-center gap-2">
          <Plus color="black" />
          <Text className="text-base font-bold">Make your first deposit</Text>
        </View>
      </Button>
    );
  };

  return <DepositOptionModal trigger={getTrigger()} />;
};

export default DepositButton;
