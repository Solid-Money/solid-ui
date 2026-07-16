import { Pressable, View } from 'react-native';

import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { VAULTS } from '@/constants/vaults';
import { VaultType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

// DepositTrigger injects its open handler via SlotTrigger.cloneElement({ onPress }),
// so this trigger MUST forward props to its root Pressable (same rule as the
// home WalletActions triggers).
const StartEarningTrigger = (props: React.ComponentProps<typeof Pressable>) => (
  <Pressable
    {...props}
    className="h-14 w-full flex-row items-center justify-center rounded-full bg-white transition-all active:scale-95 active:opacity-80"
  >
    <Text className="text-base font-bold text-black">Start earning</Text>
  </Pressable>
);

interface StartEarningButtonProps {
  /** Vault to pre-select for the deposit (mirrors the chosen APY vault). */
  vaultType: VaultType;
  className?: string;
}

/**
 * Full-width white "Start earning" CTA. Opens the shared savings deposit flow
 * (deposit-from-Solid) pre-selecting the currently chosen vault.
 */
const StartEarningButton = ({ vaultType, className }: StartEarningButtonProps) => {
  return (
    <View className={cn('px-4', className)}>
      <DepositTrigger
        modal={DEPOSIT_MODAL.OPEN_FORM}
        preserveSelectedVault
        source="savings_start_earning"
        onBeforeOpen={() => {
          const index = VAULTS.findIndex(vault => vault.type === vaultType);
          if (index >= 0) {
            useSavingStore.getState().selectVaultForDeposit(index);
          }
          useDepositStore.getState().setDepositFromSolid(true);
        }}
        trigger={<StartEarningTrigger />}
      />
    </View>
  );
};

export default StartEarningButton;
