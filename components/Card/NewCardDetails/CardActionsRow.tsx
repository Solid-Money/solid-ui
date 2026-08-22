import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import AuthorizeSpendAction from '@/components/Card/NewCardDetails/AuthorizeSpendAction';
import RegisterSpendAction from '@/components/Card/NewCardDetails/RegisterSpendAction';
import WithdrawToCardModal from '@/components/Card/WithdrawToCardModal';
import { Text } from '@/components/ui/text';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardSpendAuthorization } from '@/hooks/useCardSpendAuthorization';
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
   * Whether funds can move to/from the card at all (not frozen, KYC not paused).
   * Gates Add funds and Withdraw together — the parent derives it once so the row
   * and the desktop header cannot offer different actions for the same card.
   */
  canAddFunds: boolean;
  /** Withdraw is hidden while funds can't be moved off the card (frozen / paused KYC). */
  canWithdraw: boolean;
}

/**
 * The funding / Withdraw / Freeze / More row on the card screen.
 *
 * The first action differs by issuer, because the two cards work differently:
 *
 *  - **Rain** cards are prefunded, so it is "Add funds" — move soUSD onto the card.
 *  - **Wirex** cards hold no balance (Wirex pays the merchant and we take the soUSD
 *    from the user's Safe afterwards), so there is nothing to fund. It is
 *    "Authorize" instead: one-time permission for the card to spend from savings.
 *
 * Offering "Add funds" on a Wirex card would be offering a transfer with no
 * destination.
 *
 * Which Wirex action that is depends on `IS_WIREX_TEST`, and only ever one of them
 * appears: with the flag off (the default) it is "Set up"/"Spending", the
 * `SolidCashModule` registration flow, whose limits live on-chain; with it on it is
 * "Authorize", the older ERC-20 allowance flow. Both grant the same permission by
 * different mechanisms, so showing them together would ask the user to grant it twice
 * for one card. The choice is made in the two hooks — `isAvailable` is false on
 * whichever flow the flag did not select — not here.
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
  // Each hook's `isAvailable` already accounts for IS_WIREX_TEST and the card's issuer,
  // so no flag check is needed here — the hooks are the single place that decision lives,
  // and at most one of these two is ever true.
  const { isAvailable: canAuthorizeSpend, isAuthorized } = useCardSpendAuthorization();
  const { isAvailable: canRegisterSpend, isRegistered, isRevoked } = useCardSpendRegistration();
  // Two independent questions, deliberately not one flag. `canDepositToCard` is
  // false for a Wirex card whatever else is true — depositing has no destination.
  // `canAuthorizeSpend` additionally requires the backend to have a Card Deposit
  // Manager, so an environment without one shows neither action rather than a
  // circle that opens nothing.
  const showDeposit = canAddFunds && canDepositToCard(provider);
  const showAuthorize = canAddFunds && canAuthorizeSpend;
  const showRegister = canAddFunds && canRegisterSpend;

  return (
    <View className="flex-row items-start justify-center">
      {showAuthorize && (
        <View style={styles.item}>
          <AuthorizeSpendAction
            trigger={
              <CircleAction label={isAuthorized ? 'Authorized' : 'Authorize'}>
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
          has no collateral to withdraw — the user's soUSD never left their Safe —
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
