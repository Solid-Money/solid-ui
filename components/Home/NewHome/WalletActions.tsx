import { useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import DepositTrigger from '@/components/DepositOption/DepositTrigger';
import SendModal from '@/components/Send/SendModal';
import SlotTrigger from '@/components/SlotTrigger';
import SwapModal from '@/components/Swap/SwapModal';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useCardProvider } from '@/hooks/useCardProvider';
import { cn } from '@/lib/utils';
import { canDepositToCard } from '@/lib/utils/cardHelpers';
import { useDepositStore } from '@/store/useDepositStore';

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
  /**
   * Whether the user holds a card. Routes "Add Funds": to the card for a prefunded
   * (Rain) card, to savings for a Wirex one, to the wallet with no card at all.
   */
  hasCard?: boolean;
}

/**
 * Home action row. No funds → full-width white "Add Funds". Funded → "Add Funds"
 * plus "Swap" and "Send". Reuses the global Deposit/Swap/Send modals. Note
 * SwapModal renders null on iOS, so Swap self-hides there (same as the legacy row).
 *
 * "Add Funds" has three destinations, and none of them is a destination picker:
 *
 * - Rain cardholder → the card's direct-deposit address. The card is prefunded, so
 *   money has to land on the card itself before it can be spent.
 * - Wirex cardholder → "Deposit to savings". Their card holds no balance to deposit
 *   into (Wirex pays the merchant and we take the soUSD from their Safe on
 *   settlement), so funding savings IS funding the card — and unlike the wallet's
 *   deposit-type picker, this flow also lets them fund with a yield token (soETH /
 *   soFUSE) and spend it. See `canDepositToCard`.
 * - No card → the wallet deposit flow, unchanged.
 */
const WalletActions = ({ hasFunds, hasCard }: WalletActionsProps) => {
  const { width } = useWindowDimensions();
  const { provider } = useCardProvider();
  const fundsGoToCard = Boolean(hasCard) && canDepositToCard(provider);
  // Only a cardholder whose card cannot be deposited into, i.e. Wirex. A user with
  // no card keeps the wallet route: savings is one of the places their money can
  // go, not the only one.
  const fundsGoToSavings = Boolean(hasCard) && !fundsGoToCard;
  // Only the crowded three-pill row needs to shrink; alone, "Add Funds" always fits.
  const compact = hasFunds && width > 0 && width < COMPACT_WIDTH;
  const showSwap = hasFunds && Platform.OS !== 'ios';
  const addFundsTrigger = <AddFundsTrigger fullWidth={!hasFunds} compact={compact} />;
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  return (
    <View className={cn('flex-row items-center', compact ? 'gap-2 px-3' : 'gap-3 px-4')}>
      <View className={hasFunds ? 'h-14' : 'w-full'} style={hasFunds && styles.equalActionSlot}>
        {fundsGoToCard ? (
          // Rendered via SlotTrigger + controlled isOpen, not CardDirectDepositModal's
          // own trigger prop - that goes through ResponsiveModal's rn-primitives
          // DialogTrigger, whose asChild Slot chain drops the pill's padding classes.
          <>
            <SlotTrigger onPress={() => setIsCardModalOpen(true)}>{addFundsTrigger}</SlotTrigger>
            <CardDirectDepositModal isOpen={isCardModalOpen} onOpenChange={setIsCardModalOpen} />
          </>
        ) : fundsGoToSavings ? (
          <DepositTrigger
            modal={DEPOSIT_MODAL.OPEN_SAVINGS_FUND}
            source="home_add_funds_savings"
            onBeforeOpen={() => {
              const { setDepositFromSolid, setSavingsFundIntent } = useDepositStore.getState();
              // New money in, so the flow opens on the token list rather than the
              // move-from-Solid form.
              setDepositFromSolid(false);
              // Full token list. A `card_deposit` intent left over from the card
              // activation step would hide ETH and WFUSE, which is the opposite of
              // why this route exists.
              setSavingsFundIntent('savings');
            }}
            trigger={addFundsTrigger}
          />
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
