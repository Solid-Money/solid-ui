import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import SendModal from '@/components/Send/SendModal';
import SlotTrigger from '@/components/SlotTrigger';
import SwapModal from '@/components/Swap/SwapModal';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

// IMPORTANT: these trigger components MUST forward props (…props) to their root
// Pressable. The Deposit/Swap/Send modals inject their open handler via
// SlotTrigger.cloneElement({ onPress }); if the injected onPress isn't forwarded
// to the Pressable, tapping does nothing (the bug this file previously had).
type TriggerProps = React.ComponentProps<typeof Pressable>;

// Below this the three flex-1 pills get ~105dp each, which isn't enough for
// "Add Funds" at 16pt bold — it wrapped onto two lines on 360–390dp phones.
// Compact mode shrinks the label, icons and spacing instead of letting one pill
// grow taller/narrower than its neighbours.
const COMPACT_WIDTH = 400;

const AddFundsTrigger = ({
  fullWidth,
  compact,
  ...props
}: TriggerProps & { fullWidth: boolean; compact?: boolean }) => (
  <Pressable
    {...props}
    className={cn(
      'h-14 flex-row items-center justify-center rounded-full bg-white transition-all active:scale-95 active:opacity-80',
      compact ? 'px-2' : 'px-4',
      // On its own it stops at 24rem and centres, rather than stretching the full
      // width of a desktop column.
      fullWidth ? 'mx-auto w-full max-w-[24rem]' : 'flex-1',
    )}
  >
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={1.2}
      className={cn('font-bold text-black', compact ? 'text-sm' : 'text-base')}
    >
      Add Funds
    </Text>
  </Pressable>
);

// flex-1 like "Add Funds", so the row always splits evenly between however many
// pills it has — two halves on iOS (no Swap there), three thirds elsewhere.
const ActionPill = ({ children, compact, ...props }: TriggerProps & { compact?: boolean }) => (
  <Pressable
    {...props}
    className={cn(
      'h-14 flex-1 flex-row items-center justify-center rounded-full bg-[#1C1C1C] transition-all active:scale-95 active:opacity-80',
      compact ? 'gap-1.5 px-2' : 'gap-2 px-4',
    )}
  >
    {children}
  </Pressable>
);

const PillLabel = ({ compact, children }: { compact?: boolean; children: string }) => (
  <Text
    numberOfLines={1}
    maxFontSizeMultiplier={1.2}
    className={cn('font-semibold text-white', compact ? 'text-sm' : 'text-base')}
  >
    {children}
  </Text>
);

interface WalletActionsProps {
  /** When false, only "Add Funds" is shown full-width; when true, Swap/Send appear. */
  hasFunds: boolean;
  /** Card holders' "Add Funds" goes to the card; others go to the wallet. */
  hasCard?: boolean;
}

/**
 * Home action row. No funds → full-width white "Add Funds". Funded → "Add Funds"
 * plus "Swap" and "Send". Reuses the global Deposit/Swap/Send modals. Note
 * SwapModal renders null on iOS, so Swap self-hides there (same as the legacy row).
 *
 * "Add Funds" routes straight to the card deposit flow for card holders, or the
 * wallet deposit flow otherwise — no destination picker in between.
 */
const WalletActions = ({ hasFunds, hasCard }: WalletActionsProps) => {
  const { width } = useWindowDimensions();
  // Only the crowded three-pill row needs to shrink; alone, "Add Funds" always fits.
  const compact = hasFunds && width > 0 && width < COMPACT_WIDTH;
  const addFundsTrigger = <AddFundsTrigger fullWidth={!hasFunds} compact={compact} />;
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  return (
    <View className={cn('flex-row items-center', compact ? 'gap-2 px-3' : 'gap-3 px-4')}>
      {hasCard ? (
        // Rendered via SlotTrigger + controlled isOpen, not CardDirectDepositModal's
        // own trigger prop - that goes through ResponsiveModal's rn-primitives
        // DialogTrigger, whose asChild Slot chain drops the pill's padding classes.
        <>
          <SlotTrigger onPress={() => setIsCardModalOpen(true)}>{addFundsTrigger}</SlotTrigger>
          <CardDirectDepositModal isOpen={isCardModalOpen} onOpenChange={setIsCardModalOpen} />
        </>
      ) : (
        <DepositOptionModal trigger={addFundsTrigger} />
      )}
      {hasFunds && (
        <>
          <SwapModal
            trigger={
              <ActionPill compact={compact}>
                <HomeSwap
                  width={compact ? 17 : 20}
                  height={compact ? 17 : 20}
                  stroke="#ffffff"
                  viewBox="0 0 29 28"
                />
                <PillLabel compact={compact}>Swap</PillLabel>
              </ActionPill>
            }
          />
          <SendModal
            trigger={
              <ActionPill compact={compact}>
                <HomeSend
                  width={compact ? 15 : 18}
                  height={compact ? 15 : 18}
                  stroke="#ffffff"
                  viewBox="0 0 25 24"
                />
                <PillLabel compact={compact}>Send</PillLabel>
              </ActionPill>
            }
          />
        </>
      )}
    </View>
  );
};

export default WalletActions;
