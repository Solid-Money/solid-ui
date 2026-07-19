import { Pressable, View } from 'react-native';

import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import { Text } from '@/components/ui/text';
import UnstakeModal from '@/components/Unstake/UnstakeModal';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { VAULTS } from '@/constants/vaults';
import { VaultType } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

// Both DepositTrigger and UnstakeModal inject onPress via SlotTrigger.cloneElement,
// so these trigger components MUST forward props to their root Pressable.
const AddFundsTrigger = (props: React.ComponentProps<typeof Pressable>) => (
  <Pressable
    {...props}
    className="h-14 flex-1 flex-row items-center justify-center rounded-full bg-white transition-all active:scale-95 active:opacity-80"
  >
    <Text className="text-base font-bold text-black">Add funds</Text>
  </Pressable>
);

const WithdrawTrigger = (props: React.ComponentProps<typeof Pressable>) => (
  <Pressable
    {...props}
    className="h-14 flex-1 flex-row items-center justify-center rounded-full bg-[#1C1C1C] transition-all active:scale-95 active:opacity-80"
  >
    <Text className="text-base font-semibold text-white">Withdraw</Text>
  </Pressable>
);

interface SavingsFundedActionsProps {
  /** Vault to pre-select for the deposit (mirrors the chosen APY vault). */
  vaultType: VaultType;
}

/**
 * Funded-savings action row: "Add funds" (deposit-to-savings) + "Withdraw"
 * (unstake). Add funds pre-selects the currently chosen vault.
 */
const SavingsFundedActions = ({ vaultType }: SavingsFundedActionsProps) => {
  return (
    <View className="flex-row items-center gap-3 px-4">
      <DepositTrigger
        modal={DEPOSIT_MODAL.OPEN_FORM}
        preserveSelectedVault
        source="savings_add_funds"
        onBeforeOpen={() => {
          const index = VAULTS.findIndex(vault => vault.type === vaultType);
          if (index >= 0) {
            useSavingStore.getState().selectVaultForDeposit(index);
          }
          useDepositStore.getState().setDepositFromSolid(true);
        }}
        trigger={<AddFundsTrigger />}
      />
      <UnstakeModal trigger={<WithdrawTrigger />} />
    </View>
  );
};

export default SavingsFundedActions;
