import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';

interface EnableRealTimeFundingCardProps {
  /** The chain's assets — "USDC", or "USDT0" on Plasma. */
  assetSymbols: string[];
  /** Human chain name — "Base", "Base Sepolia". */
  chainName: string;
  /** How many networks the row covers, for the "+N more" hint. */
  networkCount: number;
  /**
   * True once every offered chain is approved.
   *
   * Switches the row from a task to a receipt: the button becomes a disabled
   * "Approved" pill and the subtitle reports what the card now draws on,
   * rather than what still needs doing.
   */
  isApproved?: boolean;
  isApproving?: boolean;
  /** Message from the last failed attempt, shown in place of the subtitle. */
  error?: string | null;
  onApprove?: () => void;
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
 * ## Why it names the assets and the chain
 *
 * Because getting either wrong is silent. An allowance is per token per
 * chain, and Rain's assets differ by chain — USDT0 on Plasma, USDC elsewhere —
 * so a cardholder holding the wrong one on the right chain has a wallet that
 * looks funded and a card that declines. Saying "USDC on Base" in the subtitle
 * is the cheapest place to catch that.
 *
 * Assets are plural because the count is a product: an allowance exists per
 * (token, spender), so a chain carrying two assets owes two sets. Rain ships
 * one asset per chain today and adds more as the feature leaves beta, and a
 * row that could only name one would start quietly lying on the day they do.
 *
 * ## Why it stays once it is done
 *
 * The row began as a task that disappeared when the allowances landed, and
 * disappearing was the wrong ending. A cardholder who has just granted an
 * unlimited allowance gets no confirmation it worked, and later no way to
 * check — the only evidence lives on a chain they cannot read, and the
 * question "does my card actually draw from my wallet" has no answer anywhere
 * in the app. So the row settles into a receipt instead: the same two lines,
 * naming the same assets and chains, with the button disabled and reading
 * Approved.
 *
 * Laid out as `EnableEuroSpendCard` and `SpendingModeCard` are: a 23px card,
 * 17px side inset, two lines of copy left and the action right — so it reads
 * as another row of the card pane rather than a promo banner.
 */
const EnableRealTimeFundingCard = ({
  assetSymbols,
  chainName,
  networkCount,
  isApproved = false,
  isApproving = false,
  error,
  onApprove,
}: EnableRealTimeFundingCardProps) => {
  const assets =
    assetSymbols.length > 1
      ? `${assetSymbols.slice(0, -1).join(', ')} and ${assetSymbols[assetSymbols.length - 1]}`
      : (assetSymbols[0] ?? 'funds');
  // Naming only the first network would understate the work by however many
  // more there are, and the extra prompts would then arrive unannounced.
  const where = networkCount > 1 ? `${chainName} +${networkCount - 1} more` : chainName;

  // Past tense once it is done, and still naming the assets and the chain: an
  // allowance is per token per chain, so a bare "Approved" would not tell a
  // cardholder holding the wrong asset why their card declines.
  const subtitle = isApproved
    ? `Approved — purchases draw ${assets} from your wallet on ${where}`
    : `Spend ${assets} straight from your wallet on ${where}`;

  return (
    <View className="overflow-hidden rounded-[23px] bg-card" style={styles.row}>
      <View style={styles.label}>
        <Text className="text-[18px] font-medium leading-[25px] text-white">Real-Time Funding</Text>
        <Text
          className={`text-[14px] leading-[18px] ${
            error ? 'text-red-400' : 'text-muted-foreground'
          }`}
        >
          {error ?? subtitle}
        </Text>
      </View>
      {isApproved ? (
        // Not a Pressable. There is nothing to press — re-approving an
        // existing allowance costs gas and changes nothing — and a disabled
        // button that still looks like a button invites the tap anyway.
        <View
          accessibilityRole="text"
          accessibilityLabel="Real-Time Funding approved"
          className="flex-row items-center gap-1.5 bg-[#1C1C1C]"
          style={styles.button}
        >
          <Check size={14} color="#94F27F" />
          <Text className="text-[15px] font-semibold text-[#94F27F]">Approved</Text>
        </View>
      ) : (
        <Pressable
          accessibilityLabel="Approve Real-Time Funding"
          accessibilityRole="button"
          accessibilityState={{ disabled: isApproving, busy: isApproving }}
          // Disabled while the user operation is in flight. A second press
          // would build a second batch of approvals against a wallet the first
          // one is already approving from — duplicate signature prompts, and a
          // second transaction the cardholder pays for and gains nothing from.
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
      )}
    </View>
  );
};

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
