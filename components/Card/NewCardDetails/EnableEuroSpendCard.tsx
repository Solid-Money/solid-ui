import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';

interface EnableEuroSpendCardProps {
  isEnabling: boolean;
  /** Message from the last failed attempt, shown in place of the subtitle. */
  error?: string;
  onEnable: () => void;
}

/**
 * "Enable euro lending" — the card that opens the Base spend instance for a cohort user.
 *
 * ## Who sees it, and when it goes away
 *
 * Only members of the `wirexTeamMembers` cohort, only where the backend reports a working Base
 * deployment, and only until they enable it. That last part is why enablement is stored per chain
 * server-side: the card disappearing for good is the whole point, and a client-side flag would
 * bring it back on the next device the user signs in on.
 *
 * ## A note on the copy
 *
 * The label says "lending", and at launch nothing is lent. The Base instance is dollar-denominated
 * and EURC is configured `spendable: true, collateral: false` — borrowing against a balance whose
 * dollar value moves with an exchange rate is a decision being taken separately, with its own risk
 * parameters. What this actually enables is spending a euro balance. The wording is the product's
 * and is kept, but it should not be read as describing a credit line, and it will be wrong in a
 * way worth revisiting if EURC is ever promoted to collateral.
 *
 * Laid out as the "Spend mode" row is (`SpendingModeCard`): a 23px card, 17px side inset, label
 * left and action right — so it reads as another row of the card pane rather than a promo banner.
 */
const EnableEuroSpendCard = ({ isEnabling, error, onEnable }: EnableEuroSpendCardProps) => (
  <View className="overflow-hidden rounded-[23px] bg-card" style={styles.row}>
    <View style={styles.label}>
      <Text className="text-[18px] font-medium leading-[25px] text-white">Enable euro lending</Text>
      <Text
        className={`text-[14px] leading-[18px] ${error ? 'text-red-400' : 'text-muted-foreground'}`}
      >
        {error ?? 'Spend your EURC balance on Base'}
      </Text>
    </View>
    <Pressable
      accessibilityLabel="Enable euro lending"
      accessibilityRole="button"
      accessibilityState={{ disabled: isEnabling, busy: isEnabling }}
      // Disabled while the user operation is in flight. Enabling twice would build a second batch
      // against a Safe the first one is already registering, and the repeat `registerSafe` reverts
      // `AlreadyRegistered` — so the second attempt fails and looks like the first one broke.
      disabled={isEnabling}
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

const styles = StyleSheet.create({
  // Matches `SpendingModeCard`: 17 either side, content centred on the height. Taller than that
  // row because this one carries a second line of copy.
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

export default EnableEuroSpendCard;
