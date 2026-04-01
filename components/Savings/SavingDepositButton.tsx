import { View } from 'react-native';
import { Plus } from 'lucide-react-native';

import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDepositStore } from '@/store/useDepositStore';

const SavingDepositButton = () => {
  const getTrigger = () => {
    return (
      <Button variant="indigo" className="h-[3.375rem] rounded-xl pr-6 md:w-72">
        <View className="flex-row items-center gap-2">
          <Plus color="white" />
          <Text className="text-base font-bold text-foreground">Deposit</Text>
        </View>
      </Button>
    );
  };

  return (
    <DepositTrigger
      modal={DEPOSIT_MODAL.OPEN_NETWORKS}
      preserveSelectedVault
      source="savings_empty_state"
      onBeforeOpen={() => {
        useDepositStore.getState().setDepositFromSolid(true);
      }}
      trigger={getTrigger()}
    />
  );
};

export default SavingDepositButton;
