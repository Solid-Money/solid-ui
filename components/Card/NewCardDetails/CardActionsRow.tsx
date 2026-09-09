import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import { SettingsAsteriskIcon } from '@/components/Card/NewCardDetails/icons';
import WithdrawToCardModal from '@/components/Card/WithdrawToCardModal';
import { Text } from '@/components/ui/text';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';
import { useWirexThreeDs } from '@/hooks/useWirexThreeDs';
import { getAsset } from '@/lib/assets';
import { canDepositToCard } from '@/lib/utils/cardHelpers';

interface CircleActionProps {
  label: string;
  children: ReactNode;
  /** Used for the loading state, when there is no Figma icon behind the spinner. */
  circleBackground?: string;
  onPress?: () => void;
  disabled?: boolean;
  /**
   * Count to overlay on the circle. Rendered outside it, because the circle
   * clips its own children so the Figma icons stay round.
   */
  badgeCount?: number;
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
  badgeCount,
}: CircleActionProps) => (
  <Pressable
    accessibilityLabel={label}
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={styles.action}
    className="items-center transition-all active:scale-95 active:opacity-80"
  >
    <View style={styles.circleSlot}>
      <View
        style={[styles.circle, circleBackground ? { backgroundColor: circleBackground } : null]}
      >
        {children}
      </View>
      {badgeCount ? (
        <View style={styles.badge} className="bg-brand">
          <Text className="text-[11px] font-semibold text-black">
            {badgeCount > 9 ? '9+' : badgeCount}
          </Text>
        </View>
      ) : null}
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
   * Opens the manage-card sheet. The sheet itself lives on the pane rather than in this
   * row, because a blocked "Show details" tap opens the same one — and it has to stay
   * reachable when this row hides its own button.
   */
  onSpendPress: () => void;
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
 *    Safe afterwards), so there is nothing to fund. It is "Set up"/"Manage" instead:
 *    registering the Safe with `SolidCashModule`, which is what gives the card
 *    permission to spend and sets the on-chain limits it may spend within, and
 *    afterwards the sheet that holds the limits, the wallet guide and the 3DS approvals
 *    queue.
 *
 * Offering "Add funds" on a Wirex card would be offering a transfer with no
 * destination.
 *
 * 3DS approvals used to have a circle of their own here. It is a queue that is empty
 * almost all the time, so it moved inside the manage sheet — but the count did not: a
 * merchant is holding each challenge on a clock, so it stays on this row as a badge on
 * "Manage", which is the one thing that would otherwise make it less visible than a
 * dedicated circle was.
 */
const CardActionsRow = ({
  isCardFrozen,
  canToggleFreeze,
  isFreezing,
  onFreezeToggle,
  onMorePress,
  onSpendPress,
  canAddFunds,
  canWithdraw,
}: CardActionsRowProps) => {
  const { provider } = useCardProvider();
  // The hook's `isAvailable` already accounts for the card's issuer, so no provider
  // check is needed here — it is the single place that decision lives.
  const { isAvailable: canRegisterSpend, isRegistered, isRevoked } = useCardSpendRegistration();
  // Wirex-only, and gated inside the hook on the issuer rather than here. The count is
  // the point of reading it from this row: a challenge whose push never arrived is
  // otherwise invisible until the user goes looking for it, and the queue itself now sits
  // a tap deeper inside the manage sheet.
  const { requests: threeDsRequests } = useWirexThreeDs();
  // Two independent questions, deliberately not one flag. `canDepositToCard` is
  // false for a Wirex card whatever else is true — depositing has no destination —
  // and `canRegisterSpend` is false for a Rain one, which has nothing to register.
  const showDeposit = canAddFunds && canDepositToCard(provider);
  // Once spending is set up this is a settings surface — limits, the wallet guide, the
  // approvals queue — and none of that is "adding funds", so a frozen card still gets it.
  // That also keeps the approvals queue reachable on a frozen card, which it was while it
  // had a circle of its own. Before setup it *is* the funding-shaped action it used to be,
  // and stays gated the way it was: an offboarded customer is not asked to grant a module.
  const showManage = canRegisterSpend && (isRegistered || canAddFunds);

  return (
    <View className="flex-row items-start justify-center">
      {showManage && (
        <View style={styles.item}>
          <CircleAction
            label={isRevoked ? 'Paused' : isRegistered ? 'Manage' : 'Set up'}
            badgeCount={threeDsRequests.length}
            onPress={onSpendPress}
          >
            {/* A plus for the press that creates the grant, the Figma settings glyph
                (20095:5554) once there is something to manage instead. */}
            {isRegistered ? (
              <SettingsAsteriskIcon />
            ) : (
              <Image
                source={getAsset('images/card-action-add-funds.png')}
                style={styles.actionIcon}
                contentFit="contain"
              />
            )}
          </CircleAction>
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
  // Anchors the badge to the circle's corner: the circle itself clips its
  // children, so the badge has to live beside it rather than inside it.
  circleSlot: { height: 50, position: 'relative', width: 50 },
  badge: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -4,
    top: -4,
  },
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
