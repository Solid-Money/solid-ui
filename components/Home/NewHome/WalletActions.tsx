import { Pressable, View } from 'react-native';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import AddFundsDestinationModal from '@/components/Home/NewHome/AddFundsDestinationModal';
import SendModal from '@/components/Send/SendModal';
import SwapModal from '@/components/Swap/SwapModal';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

// IMPORTANT: these trigger components MUST forward props (…props) to their root
// Pressable. The Deposit/Swap/Send modals inject their open handler via
// SlotTrigger.cloneElement({ onPress }); if the injected onPress isn't forwarded
// to the Pressable, tapping does nothing (the bug this file previously had).
type TriggerProps = React.ComponentProps<typeof Pressable>;

const AddFundsTrigger = ({ fullWidth, ...props }: TriggerProps & { fullWidth: boolean }) => (
  <Pressable
    {...props}
    className={cn(
      'h-14 flex-row items-center justify-center rounded-full bg-white transition-all active:scale-95 active:opacity-80',
      // On its own it stops at 24rem and centres, rather than stretching the full
      // width of a desktop column.
      fullWidth ? 'mx-auto w-full max-w-[24rem]' : 'flex-1',
    )}
  >
    <Text className="text-base font-bold text-black">Add Funds</Text>
  </Pressable>
);

// flex-1 like "Add Funds", so the row always splits evenly between however many
// pills it has — two halves on iOS (no Swap there), three thirds elsewhere.
const ActionPill = ({ children, ...props }: TriggerProps) => (
  <Pressable
    {...props}
    className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-[#1C1C1C] px-4 transition-all active:scale-95 active:opacity-80"
  >
    {children}
  </Pressable>
);

interface WalletActionsProps {
  /** When false, only "Add Funds" is shown full-width; when true, Swap/Send appear. */
  hasFunds: boolean;
  /** Card holders first pick where the money goes (card or wallet). */
  hasCard?: boolean;
}

/**
 * Home action row. No funds → full-width white "Add Funds". Funded → "Add Funds"
 * plus "Swap" and "Send". Reuses the global Deposit/Swap/Send modals. Note
 * SwapModal renders null on iOS, so Swap self-hides there (same as the legacy row).
 *
 * With a card, "Add Funds" opens a destination picker first (card vs wallet) and
 * routes to the matching deposit flow; without one it goes straight to the
 * wallet deposit modal.
 */
const WalletActions = ({ hasFunds, hasCard }: WalletActionsProps) => {
  const addFundsTrigger = <AddFundsTrigger fullWidth={!hasFunds} />;

  return (
    <View className="flex-row items-center gap-3 px-4">
      {hasCard ? (
        <AddFundsDestinationModal trigger={addFundsTrigger} />
      ) : (
        <DepositOptionModal trigger={addFundsTrigger} />
      )}
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
