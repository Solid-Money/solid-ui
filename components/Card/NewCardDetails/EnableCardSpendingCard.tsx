import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';

interface EnableCardSpendingCardProps {
  isEnabling: boolean;
  /**
   * The guardian has paused spending, globally or for this Safe. Enabling the module then
   * would succeed and still leave every payment declined, so the button waits.
   */
  isPaused: boolean;
  /** Message from the last failed attempt, shown in place of the subtitle. */
  error?: string | null;
  onEnable: () => void;
}

/**
 * "Card spending isn't set up" — shown when neither spend module is enabled on a Safe that set
 * card spending up before.
 *
 * That state comes from the Safe itself: registration is permanent, but module consent can be
 * withdrawn at any time, from "Turn card spending off" or from any Safe client. The card then
 * declines everything, and the spend-mode row disappears with it, since there is no mode to
 * change while nothing can spend. This row is what is left in its place.
 *
 * "Enable" puts back the module the Safe is registered on — v2 once it has migrated, v1
 * otherwise — with the limits it already had. Which one is `useCardSpendRegistration`'s
 * `moduleAddress`, and its `register` sends only `enableModule` for a Safe already registered;
 * this is presentation.
 *
 * Laid out as `EnableEuroSpendCard` is: a 23px card, 17px side inset, two lines of copy left
 * and the action right.
 */
const EnableCardSpendingCard = ({
  isEnabling,
  isPaused,
  error,
  onEnable,
}: EnableCardSpendingCardProps) => {
  const isDisabled = isEnabling || isPaused;
  const subtitle =
    error ??
    (isPaused
      ? 'Card spending is paused right now'
      : 'Your card will decline payments until you enable it');

  return (
    <View className="overflow-hidden rounded-[23px] bg-card" style={styles.row}>
      <View style={styles.label}>
        <Text className="text-[18px] font-medium leading-[25px] text-white">
          {"Card spending isn't set up"}
        </Text>
        <Text
          className={`text-[14px] leading-[18px] ${error ? 'text-red-400' : 'text-muted-foreground'}`}
        >
          {subtitle}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Enable card spending"
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: isEnabling }}
        // Disabled while the user operation is in flight: a second press would build another
        // `enableModule` against a Safe the first one is already enabling, and the repeat
        // reverts GS102 — so the second attempt fails and looks like the first one broke.
        disabled={isDisabled}
        className="bg-white transition-all active:scale-95 active:opacity-80 disabled:opacity-60"
        onPress={onEnable}
        style={styles.button}
      >
        {isEnabling ? (
          <ActivityIndicator color="black" size="small" />
        ) : (
          <Text className="text-[16px] font-semibold text-black">Enable</Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  // The same box as `EnableEuroSpendCard`.
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: 17,
    paddingVertical: 12,
  },
  label: { flex: 1, gap: 2, paddingRight: 12 },
  button: {
    alignItems: 'center',
    borderRadius: 100,
    height: 35,
    justifyContent: 'center',
    minWidth: 84,
    paddingHorizontal: 12,
  },
});

export default EnableCardSpendingCard;
