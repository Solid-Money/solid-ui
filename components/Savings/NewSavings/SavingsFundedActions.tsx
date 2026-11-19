import { Pressable, View } from 'react-native';

import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import { TAB_SUMMARY_ACTION_ROW, TabSummaryActionButton } from '@/components/TabSummary';
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
  variant?: 'product' | 'tab';
}

/**
 * Funded-savings action row: "Deposit" (deposit-to-savings) + "Withdraw"
 * (unstake). Deposit pre-selects the currently chosen vault.
 */
const SavingsFundedActions = ({ vaultType, variant = 'product' }: SavingsFundedActionsProps) => {
  const { modal, onBeforeOpen } = useVaultDepositEntry(vaultType);
  const deposit =
    variant === 'tab' ? (
      <TabSummaryActionButton label="Deposit" primary className="flex-1" />
    ) : (
      <DepositTriggerButton />
    );
  const withdraw =
    variant === 'tab' ? (
      <TabSummaryActionButton label="Withdraw" className="flex-1" />
    ) : (
      <WithdrawTrigger />
    );

  return (
    <View className={TAB_SUMMARY_ACTION_ROW}>
      <DepositTrigger
        modal={modal}
        preserveSelectedVault
        source="savings_add_funds"
        onBeforeOpen={onBeforeOpen}
        trigger={deposit}
      />
      <UnstakeModal trigger={withdraw} />
    </View>
  );
};

export default SavingsFundedActions;
