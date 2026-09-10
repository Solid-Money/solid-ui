import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import WirexCardFundModal from '@/components/Card/WirexCardFundModal';
import { Text } from '@/components/ui/text';
import { useCardProvider } from '@/hooks/useCardProvider';
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
  onManagePress: () => void;
  /**
   * Whether funds can move onto the card: not frozen, and KYC not paused or
   * offboarded. Derived by the parent (`canAddFundsToCard`) rather than here, so
   * this row and the freeze state it renders come from one reading of the card.
   */
  canAddFunds: boolean;
}

/** The three card actions from Figma 20095:5552. */
const CardActionsRow = ({
  isCardFrozen,
  canToggleFreeze,
  isFreezing,
  onFreezeToggle,
  onManagePress,
  canAddFunds,
}: CardActionsRowProps) => {
  const { provider } = useCardProvider();
  const { requests: threeDsRequests } = useWirexThreeDs();
  const showDeposit = canAddFunds && canDepositToCard(provider);

  return (
    <View className="flex-row items-start justify-center">
      {canAddFunds && !canDepositToCard(provider) && (
        <View style={styles.item}>
          <WirexCardFundModal
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
        <CircleAction
          label="Manage"
          onPress={onManagePress}
          circleBackground="#2A2A2A"
          badgeCount={threeDsRequests.length}
        >
          <Image
            source={getAsset('images/card-manage.svg')}
            style={{ width: 24, height: 25 }}
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
