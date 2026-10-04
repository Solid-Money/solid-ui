import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';

interface EnableRealTimeFundingCardProps {
  /** The chain's asset — "USDC", or "USDT0" on Plasma. */
  assetSymbol: string;
  /** Human chain name — "Base", "Base Sepolia". */
  chainName: string;
  isApproving: boolean;
  /** Message from the last failed attempt, shown in place of the subtitle. */
  error?: string | null;
  onApprove: () => void;
}

/**
 * "Real-Time Funding" — the row that opens the approval modal.
 *
 * ## What it is asking for
 *
 * With Real-Time Funding, a card authorization no longer spends a pre-funded
 * card balance: Rain pulls the amount out of the cardholder's own wallet at
 * the moment of the swipe. That pull runs on an ERC-20 allowance, so until the
 * wallet grants one every authorization is declined. This row is the only
 * place that is asked for, which is why it reads as a task to finish rather
 * than a feature to discover.
 *
 * ## Why it names the asset and the chain
 *
 * Because getting either wrong is silent. The allowance is per token per
 * chain, and Rain's assets differ by chain — USDT0 on Plasma, USDC elsewhere —
 * so a cardholder holding the wrong one on the right chain has a wallet that
 * looks funded and a card that declines. Saying "USDC on Base" in the subtitle
 * is the cheapest place to catch that.
 *
 * Laid out as `EnableEuroSpendCard` and `SpendingModeCard` are: a 23px card,
 * 17px side inset, two lines of copy left and the action right — so it reads
 * as another row of the card pane rather than a promo banner.
 */
const EnableRealTimeFundingCard = ({
  assetSymbol,
  chainName,
  isApproving,
  error,
  onApprove,
}: EnableRealTimeFundingCardProps) => (
  <View className="overflow-hidden rounded-[23px] bg-card" style={styles.row}>
    <View style={styles.label}>
      <Text className="text-[18px] font-medium leading-[25px] text-white">Real-Time Funding</Text>
      <Text
        className={`text-[14px] leading-[18px] ${error ? 'text-red-400' : 'text-muted-foreground'}`}
      >
        {error ?? `Spend ${assetSymbol} straight from your wallet on ${chainName}`}
      </Text>
    </View>
    <Pressable
      accessibilityLabel="Approve Real-Time Funding"
      accessibilityRole="button"
      accessibilityState={{ disabled: isApproving, busy: isApproving }}
      // Disabled while the user operation is in flight. A second press would
      // build a second batch of approvals against a wallet the first one is
      // already approving from — two signature prompts for one allowance, and
      // a second transaction the cardholder pays for and gains nothing from.
      disabled={isApproving}
      className="bg-white transition-all active:scale-95 active:opacity-80 disabled:opacity-60"
      onPress={onApprove}
      style={styles.button}
    >
      {isApproving ? (
        <ActivityIndicator color="black" size="small" />
      ) : (
        <Text className="text-[16px] font-semibold text-black">Approve</Text>
      )}
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  // Matches `EnableEuroSpendCard`: 17 either side, content centred on the
  // height, tall enough for the second line of copy.
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

export default EnableRealTimeFundingCard;
