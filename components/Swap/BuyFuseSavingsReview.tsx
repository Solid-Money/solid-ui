import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL, SWAP_MODAL } from '@/constants/modals';
import { VAULTS } from '@/constants/vaults';
import { useSwapState } from '@/store/swapStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

export default function BuyFuseSavingsReview() {
  const openSavingsDeposit = () => {
    const vaultIndex = VAULTS.findIndex(vault => vault.name === 'FUSE');
    if (vaultIndex < 0) return;
    useSwapState.getState().actions.setModal(SWAP_MODAL.CLOSE);
    const deposit = useDepositStore.getState();
    deposit.resetDepositFlow();
    useSavingStore.getState().selectVaultForDeposit(vaultIndex);
    deposit.setSrcChainId(122);
    deposit.setPrincipalToken('FUSE');
    deposit.setDepositFromSolid(true);
    deposit.setModal(DEPOSIT_MODAL.OPEN_FORM);
  };

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingVertical: 24 }}>
      <View className="gap-5">
        <Text className="text-2xl font-semibold text-white">FUSE purchase confirmed</Text>
        <Text className="text-base text-white/70">
          Step 2: Deposit FUSE to Savings. Your purchase is in your Solid wallet. It has not been
          deposited to Savings yet.
        </Text>
        <Text className="text-base text-white/70">
          Review your available FUSE balance and confirm the amount in the next step. Your tier
          changes only when your Savings position meets the requirement and rewards confirms it.
        </Text>
        <Button variant="brand" onPress={openSavingsDeposit}>
          <Text>Review Savings deposit</Text>
        </Button>
        <Button
          variant="ghost"
          onPress={() => useSwapState.getState().actions.setModal(SWAP_MODAL.CLOSE)}
        >
          <Text>Keep FUSE in wallet for now</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
