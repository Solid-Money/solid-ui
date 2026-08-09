import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import WithdrawToCardModal from '@/components/Card/WithdrawToCardModal';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

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
  isCardFrozen: boolean;
  canUnfreeze: boolean;
  isFreezing: boolean;
  onFreezeToggle: () => void;
  onMorePress: () => void;
  /** Add funds is hidden while the card can't take deposits (frozen / paused KYC). */
  canAddFunds: boolean;
  /** Withdraw is hidden while funds can't be moved off the card (frozen / paused KYC). */
  canWithdraw: boolean;
}

/** The Add funds / Withdraw / Freeze / More row on the redesigned card screen. */
const CardActionsRow = ({
  isCardFrozen,
  canUnfreeze,
  isFreezing,
  onFreezeToggle,
  onMorePress,
  canAddFunds,
  canWithdraw,
}: CardActionsRowProps) => {
  const showFreeze = !isCardFrozen || canUnfreeze;

  return (
    <View className="flex-row items-start justify-center">
      {canAddFunds && (
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
      {canWithdraw && (
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
      {showFreeze && (
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
