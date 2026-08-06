import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import CardDirectDepositModal from '@/components/Card/CardDirectDepositModal';
import {
  AddFundsIcon,
  SettingsAsteriskIcon,
  SnowflakeIcon,
} from '@/components/Card/NewCardDetails/icons';
import { Text } from '@/components/ui/text';

interface CircleActionProps {
  label: string;
  children: ReactNode;
  /** Set when the icon asset doesn't draw its own circle (e.g. the snowflake). */
  circleBackground?: string;
  onPress?: () => void;
  disabled?: boolean;
}

/**
 * One 50pt circular action with its label underneath (Figma 20095:5552). Items are
 * a fixed width so the three land on the design's x-centres regardless of how wide
 * their labels are. `onPress` is optional because modal triggers inject it.
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
    style={styles.item}
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
  /** Add funds is hidden while the card can't take deposits (frozen / paused KYC). */
  canAddFunds: boolean;
}

/** The Add funds / Freeze / Settings row on the redesigned card-details screen. */
const CardActionsRow = ({
  isCardFrozen,
  canUnfreeze,
  isFreezing,
  onFreezeToggle,
  canAddFunds,
}: CardActionsRowProps) => {
  const showFreeze = !isCardFrozen || canUnfreeze;

  return (
    <View className="flex-row items-start justify-center">
      {canAddFunds && (
        <CardDirectDepositModal
          trigger={
            <CircleAction label="Add funds">
              <AddFundsIcon />
            </CircleAction>
          }
        />
      )}
      {showFreeze && (
        <CircleAction
          label={isCardFrozen ? 'Unfreeze' : 'Freeze'}
          circleBackground="#2A2A2A"
          disabled={isFreezing}
          onPress={onFreezeToggle}
        >
          {isFreezing ? <ActivityIndicator size="small" color="white" /> : <SnowflakeIcon />}
        </CircleAction>
      )}
      {/* Card settings screen isn't built yet — the button is rendered per the
          design and does nothing until that screen exists. */}
      <CircleAction label="Settings">
        <SettingsAsteriskIcon />
      </CircleAction>
    </View>
  );
};

const styles = StyleSheet.create({
  // Figma centres the three actions 109pt apart (x≈97 / 209 / 316 on a 419 frame).
  item: { width: 109 },
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
