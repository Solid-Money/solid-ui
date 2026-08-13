import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

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

// Below this the three flex-1 pills get ~105dp each, which isn't enough for
// "Add Funds" at 16pt bold — it wrapped onto two lines on 360–390dp phones.
// Compact mode shrinks the label, icons and spacing instead of letting one pill
// grow taller/narrower than its neighbours.
const COMPACT_WIDTH = 400;

// Keep the modal/trigger implementation out of flex sizing. Each visible action
// gets an identical zero-basis slot, then its pill fills that slot. This is
// explicit instead of relying on flex styles surviving through trigger clones.
const styles = StyleSheet.create({
  equalActionSlot: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
});

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
      fullWidth ? 'mx-auto w-full max-w-[24rem]' : 'w-full',
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

// The equal-width parent slot controls sizing; the pill just fills it.
const ActionPill = ({ children, compact, ...props }: TriggerProps & { compact?: boolean }) => (
  <Pressable
    {...props}
    className={cn(
      'h-14 w-full flex-row items-center justify-center rounded-full bg-[#1C1C1C] transition-all active:scale-95 active:opacity-80',
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
  const { width } = useWindowDimensions();
  // Only the crowded three-pill row needs to shrink; alone, "Add Funds" always fits.
  const compact = hasFunds && width > 0 && width < COMPACT_WIDTH;
  const showSwap = hasFunds && Platform.OS !== 'ios';
  const addFundsTrigger = <AddFundsTrigger fullWidth={!hasFunds} compact={compact} />;

  return (
    <View className={cn('flex-row items-center', compact ? 'gap-2 px-3' : 'gap-3 px-4')}>
      <View className={hasFunds ? 'h-14' : 'w-full'} style={hasFunds && styles.equalActionSlot}>
        {hasCard ? (
          <AddFundsDestinationModal trigger={addFundsTrigger} />
        ) : (
          <DepositOptionModal trigger={addFundsTrigger} />
        )}
      </View>
      {showSwap && (
        <View className="h-14" style={styles.equalActionSlot}>
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
        </View>
      )}
      {hasFunds && (
        <View className="h-14" style={styles.equalActionSlot}>
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
        </View>
      )}
    </View>
  );
};

export default WalletActions;
