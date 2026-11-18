import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import SendModal from '@/components/Send/SendModal';
import SlotTrigger from '@/components/SlotTrigger';
import SwapModal from '@/components/Swap/SwapModal';
import {
  TAB_SUMMARY_ACTION_HEIGHT,
  TAB_SUMMARY_ACTION_ROW,
  TabSummaryActionButton,
  useCompactTabSummaryActions,
} from '@/components/TabSummary';
import { useCardProvider } from '@/hooks/useCardProvider';
import { HOME_SWAP_PRESET } from '@/lib/swapDefaults';
import { canDepositToCard } from '@/lib/utils/cardHelpers';

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

interface WalletActionsProps {
  /** When false, only "Add Funds" is shown full-width; when true, Swap/Send appear. */
  hasFunds: boolean;
  /**
   * Whether the user holds a card. Routes "Add Funds": to the card's own funding
   * flow for either issuer, to the wallet with no card at all.
   */
  hasCard?: boolean;
}

/**
 * Home action row. No funds → full-width white "Add Funds". Funded → "Add Funds"
 * plus "Swap" and "Send". Reuses the global Deposit/Swap/Send modals.
 *
 * "Add Funds" has three destinations, and none of them is a destination picker:
 *
 * - Rain cardholder → the card's direct-deposit address. The card is prefunded, so
 *   money has to land on the card itself before it can be spent.
 * - Wirex cardholder → the wallet deposit flow, the same as someone with no card at
 *   all. Their card holds no balance of its own: Wirex pays the merchant and we take
 *   the stablecoin from their Safe on settlement, so funding the wallet IS funding the
 *   card and a separate card-funding flow would be the same destination under another
 *   name. `canDepositToCard` stays false for them, which is what routes them here.
 * - No card → the wallet deposit flow.
 */
const WalletActions = ({ hasFunds, hasCard }: WalletActionsProps) => {
  const compact = useCompactTabSummaryActions();
  const { provider } = useCardProvider();
  const fundsGoToCard = Boolean(hasCard) && canDepositToCard(provider);
  const addFundsTrigger = <TabSummaryActionButton label="Add Funds" primary className="w-full" />;
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  return (
    <View className={TAB_SUMMARY_ACTION_ROW}>
      <View
        className={hasFunds ? TAB_SUMMARY_ACTION_HEIGHT : 'w-full'}
        style={hasFunds && styles.equalActionSlot}
      >
        {fundsGoToCard ? (
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
      </View>
      {hasFunds && (
        <View className={TAB_SUMMARY_ACTION_HEIGHT} style={styles.equalActionSlot}>
          <SwapModal
            entryPoint="home"
            preset={HOME_SWAP_PRESET}
            trigger={
              <TabSummaryActionButton
                label="Swap"
                className="w-full"
                icon={
                  <HomeSwap
                    width={compact ? 17 : 20}
                    height={compact ? 17 : 20}
                    stroke="#ffffff"
                    viewBox="0 0 29 28"
                  />
                }
              />
            }
          />
        </View>
      )}
      {hasFunds && (
        <View className={TAB_SUMMARY_ACTION_HEIGHT} style={styles.equalActionSlot}>
          <SendModal
            trigger={
              <TabSummaryActionButton
                label="Send"
                className="w-full"
                icon={
                  <HomeSend
                    width={compact ? 15 : 18}
                    height={compact ? 15 : 18}
                    stroke="#ffffff"
                    viewBox="0 0 25 24"
                  />
                }
              />
            }
          />
        </View>
      )}
    </View>
  );
};

export default WalletActions;
