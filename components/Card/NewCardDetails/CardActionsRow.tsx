import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import RegisterSpendAction from '@/components/Card/NewCardDetails/RegisterSpendAction';
import WithdrawToCardModal from '@/components/Card/WithdrawToCardModal';
import { Text } from '@/components/ui/text';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';
import { getAsset } from '@/lib/assets';
import { canDepositToCard } from '@/lib/utils/cardHelpers';

interface CircleActionProps {
  label: string;
  children: ReactNode;
  /** Used for the loading state, when there is no Figma icon behind the spinner. */
  circleBackground?: string;
  onPress?: () => void;
  disabled?: boolean;
}

/**
 * One 50pt circular action with its label underneath (Figma 20095:5552). Items share
 * the available row width, capped at the original design spacing. `onPress` is
 * optional because modal triggers inject it.
 */
const CircleAction = ({
  label,
  children,
  circleBackground,
  onPress,
  disabled,
}: CircleActionProps) => (
  <Pressable
    accessibilityLabel={label}
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={styles.action}
    className="items-center transition-all active:scale-95 active:opacity-80"
  >
    <View style={[styles.circle, circleBackground ? { backgroundColor: circleBackground } : null]}>
      {children}
    </View>
    <Text className="mt-[8px] text-center text-[14px] font-medium text-[#BFBFBF]">{label}</Text>
  </Pressable>
);

interface CardActionsRowProps {
  /** Drives the label only — whether to offer the toggle is `canToggleFreeze`. */
  isCardFrozen: boolean;
  /**
   * Whether to show the freeze toggle at all. Derived by the parent from
   * `canToggleCardFreeze`, so this row and the desktop header can't drift into
   * offering different actions for the same card.
   */
  canToggleFreeze: boolean;
  isFreezing: boolean;
  onFreezeToggle: () => void;
  onMorePress: () => void;
  /**
   * Whether funds can move onto the card: not frozen, and KYC not paused or
   * offboarded. Derived by the parent (`canAddFundsToCard`) rather than here, so
   * this row and the freeze state it renders come from one reading of the card.
   */
  canAddFunds: boolean;
  /**
   * Whether funds can move off the card (`canWithdrawFromCard`). Not the mirror of
   * `canAddFunds`: a freeze stops the card spending but leaves the collateral
   * withdrawable, so this stays true on a frozen card and only a paused or
   * offboarded customer turns it off.
   */
  canWithdraw: boolean;
}

/**
 * The funding / Withdraw / Freeze / More row on the card screen.
 *
 * The first action differs by issuer, because the two cards work differently:
 *
 *  - **Rain** cards are prefunded, so it is "Add funds" — move soUSD onto the card.
 *  - **Wirex** cards hold no balance (Wirex pays the merchant and we debit the user's
 *    Safe afterwards), so there is nothing to fund. It is "Set up"/"Spending"
 *    instead: registering the Safe with `SolidCashModule`, which is what gives the
 *    card permission to spend and sets the on-chain limits it may spend within.
 *
 * Offering "Add funds" on a Wirex card would be offering a transfer with no
 * destination.
 */
const CardActionsRow = ({
  isCardFrozen,
  canToggleFreeze,
  isFreezing,
  onFreezeToggle,
  onMorePress,
  canAddFunds,
  canWithdraw,
}: CardActionsRowProps) => {
  const { provider } = useCardProvider();
  // The hook's `isAvailable` already accounts for the card's issuer, so no provider
  // check is needed here — it is the single place that decision lives.
  const { isAvailable: canRegisterSpend, isRegistered, isRevoked } = useCardSpendRegistration();
  // Two independent questions, deliberately not one flag. `canDepositToCard` is
  // false for a Wirex card whatever else is true — depositing has no destination —
  // and `canRegisterSpend` is false for a Rain one, which has nothing to register.
  const showDeposit = canAddFunds && canDepositToCard(provider);
  const showRegister = canAddFunds && canRegisterSpend;

  return (
    <View className="flex-row items-start justify-center">
      {showRegister && (
        <View style={styles.item}>
          <RegisterSpendAction
            trigger={
              <CircleAction label={isRevoked ? 'Paused' : isRegistered ? 'Spending' : 'Set up'}>
                <Image
                  source={getAsset('images/card-action-add-funds.png')}
                  style={styles.actionIcon}
                  contentFit="contain"
                />
              </CircleAction>
            }
          />
        </View>
      )}
      {showDeposit && (
        <View style={styles.item}>
          <CardDirectDepositModal
            trigger={
              <CircleAction label="Add funds">
                <Image
                  source={getAsset('images/card-action-add-funds.png')}
                  style={styles.actionIcon}
                  contentFit="contain"
                />
              </CircleAction>
            }
          />
        </View>
      )}
      {/* Withdraw moves tokens back out of the Rain collateral proxy. A Wirex card
          has no collateral to withdraw — the user's assets never left their Safe —
          so the flow has nothing to act on and is hidden rather than offered and
          then failed. */}
      {canWithdraw && canDepositToCard(provider) && (
        <View style={styles.item}>
          <WithdrawToCardModal
            trigger={
              <CircleAction label="Withdraw">
                <Image
                  source={getAsset('images/card-action-withdraw.png')}
                  style={styles.actionIcon}
                  contentFit="contain"
                />
              </CircleAction>
            }
          />
        </View>
      )}
      {canToggleFreeze && (
        <View style={styles.item}>
          <CircleAction
            label={isCardFrozen ? 'Unfreeze' : 'Freeze'}
            circleBackground="#2A2A2A"
            disabled={isFreezing}
            onPress={onFreezeToggle}
          >
            {isFreezing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Image
                source={getAsset('images/card-action-freeze.png')}
                style={styles.actionIcon}
                contentFit="contain"
              />
            )}
          </CircleAction>
        </View>
      )}
      <View style={styles.item}>
        <CircleAction label="More" onPress={onMorePress}>
          <Image
            source={getAsset('images/card-action-more.png')}
            style={styles.actionIcon}
            contentFit="contain"
          />
        </CircleAction>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // The equal-width wrapper must sit outside the modal components. Otherwise their
  // trigger labels determine the first two columns' widths and shift the icon centres.
  item: { flex: 1, maxWidth: 109 },
  action: { width: '100%' },
  actionIcon: { height: 50, width: 50 },
  circle: {
    alignItems: 'center',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 50,
  },
});

export default CardActionsRow;
