import { Pressable, View } from 'react-native';

import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import { Text } from '@/components/ui/text';
import UnstakeModal from '@/components/Unstake/UnstakeModal';
import { useVaultDepositEntry } from '@/hooks/useVaultDepositEntry';
import { VaultType } from '@/lib/types';

// Both DepositTrigger and UnstakeModal inject onPress via SlotTrigger.cloneElement,
// so these trigger components MUST forward props to their root Pressable.
const DepositTriggerButton = (props: React.ComponentProps<typeof Pressable>) => (
  <Pressable
    {...props}
    className="h-[50px] flex-1 flex-row items-center justify-center rounded-full bg-white transition-all active:scale-95 active:opacity-80"
  >
    <Text className="text-base font-semibold text-black">Deposit</Text>
  </Pressable>
);

const WithdrawTrigger = (props: React.ComponentProps<typeof Pressable>) => (
  <Pressable
    {...props}
    className="h-[50px] flex-1 flex-row items-center justify-center rounded-full bg-[#1C1C1C] transition-all active:scale-95 active:opacity-80"
  >
    <Text className="text-base font-semibold text-white">Withdraw</Text>
  </Pressable>
);

interface SavingsFundedActionsProps {
  /** Vault to pre-select for the deposit (mirrors the chosen APY vault). */
  vaultType: VaultType;
}

/**
 * Funded-savings action row: "Deposit" (deposit-to-savings) + "Withdraw"
 * (unstake). Deposit pre-selects the currently chosen vault.
 */
const SavingsFundedActions = ({ vaultType }: SavingsFundedActionsProps) => {
  const { modal, onBeforeOpen } = useVaultDepositEntry(vaultType);

  return (
    <View className="flex-row items-center gap-3 px-4">
      <DepositTrigger
        modal={modal}
        preserveSelectedVault
        source="savings_add_funds"
        onBeforeOpen={onBeforeOpen}
        trigger={<DepositTriggerButton />}
      />
      <UnstakeModal trigger={<WithdrawTrigger />} />
    </View>
  );
};

export default SavingsFundedActions;
