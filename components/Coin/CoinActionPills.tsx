import { Pressable, View } from 'react-native';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import SendModal from '@/components/Send/SendModal';
import SwapModal from '@/components/Swap/SwapModal';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { cn } from '@/lib/utils';
import { TokenVault } from '@/lib/vaults';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

type CoinActionPillsProps = {
  tokenVault: TokenVault | undefined;
};

type PillProps = {
  label: string;
  icon?: React.ReactNode;
  variant?: 'light' | 'dark';
  onPress?: () => void;
};

const Pill = ({ label, icon, variant = 'dark', onPress }: PillProps) => (
  <Pressable
    onPress={onPress}
    className={cn(
      'h-[50px] flex-row items-center justify-center gap-2 rounded-full px-5 active:opacity-80',
      variant === 'light' ? 'bg-white' : 'bg-card',
    )}
  >
    {icon}
    <Text
      className={cn('text-base font-semibold', variant === 'light' ? 'text-black' : 'text-white')}
    >
      {label}
    </Text>
  </Pressable>
);

/** Deposit / Swap / Send row on the mobile coin page. */
const CoinActionPills = ({ tokenVault }: CoinActionPillsProps) => {
  return (
    <View className="flex-row items-center justify-center gap-2">
      <DepositTrigger
        // Yield-bearing assets deposit straight into their own vault; everything
        // else can only be topped up, so fall back to the add-funds options.
        modal={tokenVault ? DEPOSIT_MODAL.OPEN_FORM : DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE}
        source="coin_actions"
        preserveSelectedVault={!!tokenVault}
        onBeforeOpen={() => {
          if (!tokenVault) return;
          useSavingStore.getState().selectVaultForDeposit(tokenVault.index);
          useDepositStore.getState().setDepositFromSolid(true);
        }}
        trigger={<Pill label="Deposit" variant="light" />}
      />

      {/* Both SVGs declare a fixed canvas without a viewBox, so resizing them
          requires passing the original viewBox alongside the new dimensions. */}
      <SwapModal
        trigger={
          <Pill label="Swap" icon={<HomeSwap width={20} height={19.5} viewBox="0 0 29 28" />} />
        }
      />

      <SendModal
        trigger={
          <Pill label="Send" icon={<HomeSend width={17} height={16.3} viewBox="0 0 25 24" />} />
        }
      />
    </View>
  );
};

export default CoinActionPills;
