import { Pressable, View } from 'react-native';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import SendModal from '@/components/Send/SendModal';
import SwapModal from '@/components/Swap/SwapModal';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

// Triggers are Pressables (not Views) so the modals' SlotTrigger clones them and
// preserves layout classes like flex-1 / w-full rather than wrapping in a plain
// auto-width Pressable.
const AddFundsTrigger = ({ fullWidth }: { fullWidth: boolean }) => (
  <Pressable
    className={cn(
      'h-14 flex-row items-center justify-center rounded-full bg-white transition-all active:scale-95 active:opacity-80',
      fullWidth ? 'w-full' : 'flex-1',
    )}
  >
    <Text className="text-base font-bold text-black">Add Funds</Text>
  </Pressable>
);

const ActionPill = ({ children }: { children: React.ReactNode }) => (
  <Pressable className="h-14 flex-row items-center justify-center gap-2 rounded-full bg-[#1C1C1C] px-6 transition-all active:scale-95 active:opacity-80">
    {children}
  </Pressable>
);

interface WalletActionsProps {
  /** When false, only "Add Funds" is shown full-width; when true, Swap/Send appear. */
  hasFunds: boolean;
}

/**
 * Home action row. No funds → full-width white "Add Funds". Funded → "Add Funds"
 * plus "Swap" and "Send". Reuses the global Deposit/Swap/Send modals. Note
 * SwapModal renders null on iOS, so Swap self-hides there (same as the legacy row).
 */
const WalletActions = ({ hasFunds }: WalletActionsProps) => {
  return (
    <View className="flex-row items-center gap-3 px-4">
      <DepositOptionModal trigger={<AddFundsTrigger fullWidth={!hasFunds} />} />
      {hasFunds && (
        <>
          <SwapModal
            trigger={
              <ActionPill>
                <HomeSwap width={20} height={20} stroke="#ffffff" viewBox="0 0 29 28" />
                <Text className="text-base font-semibold text-white">Swap</Text>
              </ActionPill>
            }
          />
          <SendModal
            trigger={
              <ActionPill>
                <HomeSend width={18} height={18} stroke="#ffffff" viewBox="0 0 25 24" />
                <Text className="text-base font-semibold text-white">Send</Text>
              </ActionPill>
            }
          />
        </>
      )}
    </View>
  );
};

export default WalletActions;
