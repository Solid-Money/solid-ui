import { Pressable, View } from 'react-native';

import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import { TabSummaryActionButton } from '@/components/TabSummary';
import { Text } from '@/components/ui/text';
import { useVaultDepositEntry } from '@/hooks/useVaultDepositEntry';
import { VaultType } from '@/lib/types';
import { cn } from '@/lib/utils';

// DepositTrigger injects its open handler via SlotTrigger.cloneElement({ onPress }),
// so this trigger MUST forward props to its root Pressable (same rule as the
// home WalletActions triggers).
const DepositTriggerButton = ({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof Pressable>) => (
  <Pressable
    {...props}
    className="h-[50px] w-full flex-row items-center justify-center rounded-full bg-white transition-all active:scale-95 active:opacity-80"
  >
    <Text className="text-base font-semibold text-black">{label}</Text>
  </Pressable>
);

interface StartEarningButtonProps {
  /** Vault to pre-select for the deposit (mirrors the chosen APY vault). */
  vaultType: VaultType;
  /** Button label — "Start earning" (empty state) or "Add funds" (funded). */
  label?: string;
  source?: string;
  className?: string;
  variant?: 'product' | 'tab';
}

/**
 * Full-width white savings deposit CTA. Opens the shared deposit-from-Solid flow
 * pre-selecting the currently chosen vault. Used as "Start earning" on the empty
 * state and "Add funds" once savings is funded.
 */
const StartEarningButton = ({
  vaultType,
  label = 'Start earning',
  source = 'savings_start_earning',
  className,
  variant = 'product',
}: StartEarningButtonProps) => {
  const { modal, onBeforeOpen } = useVaultDepositEntry(vaultType);
  const deposit =
    variant === 'tab' ? (
      <TabSummaryActionButton label={label} primary className="w-full" />
    ) : (
      <DepositTriggerButton label={label} />
    );

  return (
    <View className={cn('px-4', className)}>
      <DepositTrigger
        modal={modal}
        preserveSelectedVault
        source={source}
        onBeforeOpen={onBeforeOpen}
        trigger={deposit}
      />
    </View>
  );
};

export default StartEarningButton;
