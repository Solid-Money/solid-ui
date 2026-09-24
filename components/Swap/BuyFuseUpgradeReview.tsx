import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL, SWAP_MODAL } from '@/constants/modals';
import { VAULTS } from '@/constants/vaults';
import { RewardsTier } from '@/lib/types';
import { type BuyFuseUpgradeContext, useSwapState } from '@/store/swapStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';
import { useTierUpgradeStore } from '@/store/useTierUpgradeStore';

export default function BuyFuseUpgradeReview({ context }: { context: BuyFuseUpgradeContext }) {
  const close = () => useSwapState.getState().actions.setModal(SWAP_MODAL.CLOSE);

  const continueUpgrade = () => {
    const { tier } = context;
    if (tier === RewardsTier.CORE) return;
    close();
    setTimeout(() => {
      const upgrade = useTierUpgradeStore.getState();
      upgrade.open(tier);
      upgrade.setRoute('lock');
      // The purchase supplies native FUSE. The zap can deposit and lock it in
      // the upgrade transaction, even if another token was selected earlier.
      upgrade.setLockAsset('FUSE');
    }, 200);
  };

  const depositToSavings = () => {
    const vaultIndex = VAULTS.findIndex(vault => vault.name === 'FUSE');
    if (vaultIndex < 0) return;
    close();
    setTimeout(() => {
      const deposit = useDepositStore.getState();
      deposit.resetDepositFlow();
      useSavingStore.getState().selectVaultForDeposit(vaultIndex);
      deposit.setSrcChainId(122);
      deposit.setPrincipalToken('FUSE');
      deposit.setDepositFromSolid(true);
      deposit.setModal(DEPOSIT_MODAL.OPEN_FORM);
    }, 200);
  };

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingVertical: 24 }}>
      <View className="gap-5">
        <Text className="text-2xl font-semibold text-white">FUSE purchase confirmed</Text>
        <Text className="text-base text-white/70">
          Your FUSE is in your Solid wallet. Your tier upgrade is not complete yet.
        </Text>
        <Text className="text-base text-white/70">
          {context.depositToSavings
            ? 'Deposit the FUSE to Savings, then return to your upgrade to review and confirm the lock.'
            : 'Return to your upgrade to review the amount and lock duration before confirming.'}
        </Text>
        <Button
          variant="brand"
          onPress={context.depositToSavings ? depositToSavings : continueUpgrade}
        >
          <Text>{context.depositToSavings ? 'Deposit FUSE to Savings' : 'Continue upgrade'}</Text>
        </Button>
        <Button variant="ghost" onPress={close}>
          <Text>Keep FUSE in wallet for now</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
