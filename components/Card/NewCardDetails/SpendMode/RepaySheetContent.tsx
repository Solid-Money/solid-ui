import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextStyle, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Check, ChevronDown, ChevronLeft } from 'lucide-react-native';

import SheetTextInput from '@/components/Card/NewCardDetails/SpendMode/SheetTextInput';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { formatUsd } from '@/constants/cardSpendModule';
import getTokenIcon from '@/lib/getTokenIcon';
import {
  formatRepayTokenAmount,
  maxRepayableUsd,
  parseUsdAmountText,
  quoteRepay,
  type RepaySource,
  sanitizeUsdAmountText,
  usdToAmountText,
} from '@/lib/utils/cardRepay';

import type { CardRepayRequest, CardRepayState } from '@/hooks/useCardRepay';

/**
 * Vertical rhythm. Each value is the gap from the element above it, on the same 17pt inset
 * and card language as the borrow position this step slides in from.
 */
const HEADER_TO_SUMMARY = 35;
const CARD_GAP = 12;
const INPUT_TO_NOTE = 16;
/** The note's `leading-[18px]`. */
const NOTE_LINE_HEIGHT = 18;
const NOTE_TO_ACTION = 28;
const ACTION_GAP = 12;
/** Space held for the body while the first read is in flight, so the sheet does not jump. */
const LOADING_HEIGHT = 260;
/** How far the Repay button fades back while it cannot be pressed. Matches the mode sheet. */
const DISABLED_DIM = 0.45;
const PICKER_FADE_IN = 180;
const PICKER_FADE_OUT = 120;

const RED = '#D96167';

interface RepaySheetContentProps {
  state: CardRepayState | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Resolves true once the repayment is on-chain, false when it did not happen. */
  onRepay: (request: CardRepayRequest) => Promise<boolean>;
  isRepaying: boolean;
  /** Why the last attempt failed, or null. */
  error: string | null;
  onClearError: () => void;
  /** Back to the borrow position. */
  onBack: () => void;
  /** Close the sheet. */
  onDismiss: () => void;
  topPadding: number;
}

/**
 * The repay step of the borrow-position sheet: how much, paid with what, and one button.
 *
 * The source list mixes the two ways the module can be paid. Wallet rows are tender tokens the
 * Safe holds loose; collateral rows spend the soUSD already escrowed against the loan, which
 * is how someone with nothing loose closes a position. The same token can appear twice, so
 * every row and the balance line say which of the two it is.
 *
 * Nothing here decides what a repayment does — `quoteRepay` does, and the hook runs it again
 * against a fresh read before signing — so the figure on the button is the one that gets sent.
 */
const RepaySheetContent = ({
  state,
  isLoading,
  isError,
  onRetry,
  onRepay,
  isRepaying,
  error,
  onClearError,
  onBack,
  onDismiss,
  topPadding,
}: RepaySheetContentProps) => {
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [isMax, setIsMax] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const sources = useMemo(() => state?.sources ?? [], [state]);
  const source = sources.find(candidate => candidate.id === sourceId) ?? null;

  // The most useful source until the cardholder picks one, and again if the one they picked
  // disappears from a refreshed read.
  useEffect(() => {
    if (sources.length === 0) return;
    if (!sourceId || !sources.some(candidate => candidate.id === sourceId)) {
      setSourceId(sources[0].id);
    }
  }, [sources, sourceId]);

  const debtUsd = state?.debtUsd ?? 0n;
  const amountUsd = parseUsdAmountText(text);

  const quote = useMemo(
    () =>
      state && source
        ? quoteRepay({
            debtUsd: state.debtUsd,
            borrowApyPerSecond: state.borrowApyPerSecond,
            source,
            collateral: state.collateral,
            amountUsd,
            isMax,
          })
        : null,
    [state, source, amountUsd, isMax],
  );

  const handleChangeText = useCallback(
    (next: string) => {
      setText(sanitizeUsdAmountText(next));
      setIsMax(false);
      if (error) onClearError();
    },
    [error, onClearError],
  );

  const fillMax = useCallback(
    (target: RepaySource) => {
      setText(usdToAmountText(maxRepayableUsd(debtUsd, target)));
      setIsMax(true);
      if (error) onClearError();
    },
    [debtUsd, error, onClearError],
  );

  const handleSelect = useCallback(
    (next: RepaySource) => {
      setSourceId(next.id);
      setIsPickerOpen(false);
      // MAX means "as much as this source can", so it follows the source rather than keeping
      // a figure worked out for the previous one.
      if (isMax) fillMax(next);
      if (error) onClearError();
    },
    [error, fillMax, isMax, onClearError],
  );

  const canSubmit = quote?.ok === true && !isRepaying;

  const handleRepay = useCallback(() => {
    if (!canSubmit || !source) return;
    void onRepay({ sourceId: source.id, amountUsd: isMax ? null : amountUsd, isMax });
  }, [amountUsd, canSubmit, isMax, onRepay, source]);

  const note = describeQuote(quote, source, error);

  return (
    <View style={[styles.body, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to borrow position"
          accessibilityRole="button"
          className="transition-all active:scale-95 active:opacity-80"
          disabled={isRepaying}
          hitSlop={8}
          onPress={onBack}
          style={styles.back}
        >
          <ChevronLeft color="#FFFFFF" size={22} />
        </Pressable>
        <Text className="text-center text-[30px] font-medium leading-[36px] text-white">Repay</Text>
      </View>

      {!state ? (
        <View style={styles.loading}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text className="text-center text-[16px] font-normal leading-[20px] text-white/70">
                {isError ? 'Could not load your loan.' : 'Nothing to repay.'}
              </Text>
              {isError ? (
                <Pressable
                  accessibilityLabel="Try again"
                  accessibilityRole="button"
                  className="transition-all active:scale-95 active:opacity-80"
                  onPress={onRetry}
                  style={styles.retry}
                >
                  <Text className="text-[16px] font-semibold text-white">Try again</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : (
        <>
          <View style={[styles.card, styles.summary]}>
            <SummaryRow label="Borrowed" value={formatUsd(debtUsd)} />
            <SummaryRow
              label="After repaying"
              value={formatUsd(quote?.ok ? quote.remainingDebtUsd : debtUsd)}
            />
          </View>

          <View style={[styles.card, styles.input]}>
            <View style={styles.inputRow}>
              <View style={styles.amountColumn}>
                <Text className="text-[16px] font-normal leading-[18px] text-white/70">
                  Amount to repay
                </Text>
                <View style={styles.amountRow}>
                  <Text
                    className={
                      text
                        ? 'text-[40px] font-semibold text-white'
                        : 'text-[40px] font-semibold text-white/30'
                    }
                    style={styles.currency}
                  >
                    $
                  </Text>
                  <SheetTextInput
                    accessibilityLabel="Amount to repay in dollars"
                    // Web only, where this is React Native's own input: the browser's focus
                    // ring would draw a box inside the card.
                    className="web:outline-none"
                    editable={!isRepaying}
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    onChangeText={handleChangeText}
                    placeholder="0.00"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    selectionColor="#94F27F"
                    style={amountInputStyle}
                    value={text}
                  />
                </View>
              </View>

              <View style={styles.withColumn}>
                <Text className="text-[14px] font-normal leading-[16px] text-white/50">
                  Repay with
                </Text>
                <Pressable
                  accessibilityLabel={
                    source
                      ? `Repay with ${source.displaySymbol} ${source.kind === 'wallet' ? 'from wallet' : 'collateral'}. Change`
                      : 'Choose what to repay with'
                  }
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isPickerOpen }}
                  className="transition-all active:scale-95 active:opacity-80"
                  disabled={isRepaying || sources.length === 0}
                  onPress={() => setIsPickerOpen(open => !open)}
                  style={styles.selector}
                >
                  {source ? (
                    <>
                      <RenderTokenIcon
                        tokenIcon={getTokenIcon({ tokenSymbol: source.symbol, size: 24 })}
                        size={24}
                        tokenName={source.displaySymbol}
                      />
                      <Text className="text-[16px] font-semibold text-white">
                        {source.displaySymbol}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-[16px] font-semibold text-white">Choose</Text>
                  )}
                  <ChevronDown color="rgba(255,255,255,0.7)" size={16} />
                </Pressable>
              </View>
            </View>

            <View style={styles.balanceRow}>
              <Text
                className="flex-1 text-[14px] font-normal leading-[16px] text-white/70"
                numberOfLines={1}
              >
                {source ? describeBalance(source) : ' '}
              </Text>
              <Pressable
                accessibilityLabel="Repay the maximum"
                accessibilityRole="button"
                className="transition-all active:scale-95 active:opacity-80"
                disabled={!source || isRepaying}
                onPress={() => source && fillMax(source)}
                style={[styles.max, isMax && styles.maxActive]}
              >
                <Text
                  className={
                    isMax
                      ? 'text-[14px] font-semibold text-black'
                      : 'text-[14px] font-semibold text-white'
                  }
                >
                  MAX
                </Text>
              </Pressable>
            </View>
          </View>

          {isPickerOpen ? (
            <Animated.View
              entering={FadeIn.duration(PICKER_FADE_IN)}
              exiting={FadeOut.duration(PICKER_FADE_OUT)}
              style={[styles.card, styles.picker]}
            >
              {sources.map(option => (
                <SourceRow
                  key={option.id}
                  source={option}
                  isSelected={option.id === sourceId}
                  onPress={() => handleSelect(option)}
                />
              ))}
            </Animated.View>
          ) : null}

          {note ? (
            <Text
              className="text-center text-[14px] font-normal leading-[18px]"
              style={[styles.note, { color: note.isError ? RED : 'rgba(255,255,255,0.7)' }]}
            >
              {note.text}
            </Text>
          ) : null}

          <Pressable
            accessibilityLabel={isRepaying ? 'Confirming repayment' : actionLabel(quote)}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit, busy: isRepaying }}
            className="bg-brand transition-all active:scale-95 active:opacity-80"
            disabled={!canSubmit}
            onPress={handleRepay}
            style={[
              styles.action,
              note ? null : styles.actionWithoutNote,
              // Lit while confirming: the spinner and "Confirming…" say it is busy, and dimming
              // it as well would read as a failure.
              { opacity: canSubmit || isRepaying ? 1 : 1 - DISABLED_DIM },
            ]}
          >
            {isRepaying ? <ActivityIndicator size="small" color="#000000" /> : null}
            <Text className="text-[16px] font-bold text-black">
              {isRepaying ? 'Confirming…' : actionLabel(quote)}
            </Text>
          </Pressable>
        </>
      )}

      <Pressable
        accessibilityLabel="Close"
        accessibilityRole="button"
        className="transition-all active:scale-95 active:opacity-80"
        disabled={isRepaying}
        onPress={onDismiss}
        style={styles.cancel}
      >
        <Text className="text-[16px] font-semibold text-white">Cancel</Text>
      </Pressable>
    </View>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.summaryRow}>
    <Text className="text-[16px] font-normal leading-[18px] text-white/70">{label}</Text>
    <Text className="text-[16px] font-medium leading-[18px] text-white">{value}</Text>
  </View>
);

interface SourceRowProps {
  source: RepaySource;
  isSelected: boolean;
  onPress: () => void;
}

/** One row of the picker. A source that cannot be used still shows, and says why. */
const SourceRow = ({ source, isSelected, onPress }: SourceRowProps) => {
  const isUsable = source.unavailableReason === null;
  const where = source.kind === 'wallet' ? 'Wallet' : 'Collateral';

  return (
    <Pressable
      accessibilityLabel={`${source.displaySymbol}, ${where}, ${formatUsd(source.valueUsd)}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled: !isUsable }}
      className="transition-all active:opacity-70"
      disabled={!isUsable}
      onPress={onPress}
      style={[styles.sourceRow, !isUsable && styles.sourceRowDisabled]}
    >
      <RenderTokenIcon
        tokenIcon={getTokenIcon({ tokenSymbol: source.symbol, size: 32 })}
        size={32}
        tokenName={source.displaySymbol}
      />
      <View style={styles.sourceText}>
        <Text className="text-[16px] font-semibold leading-[18px] text-white">
          {source.displaySymbol}
        </Text>
        <Text className="text-[14px] font-normal leading-[16px] text-white/50" numberOfLines={1}>
          {source.unavailableReason ?? where}
        </Text>
      </View>
      <View style={styles.sourceValue}>
        <Text className="text-[16px] font-medium leading-[18px] text-white">
          {formatUsd(source.valueUsd)}
        </Text>
        <Text className="text-[14px] font-normal leading-[16px] text-white/50">
          {formatRepayTokenAmount(source.balance, source.decimals)} {source.displaySymbol}
        </Text>
      </View>
      <View style={styles.check}>{isSelected ? <Check color="#94F27F" size={18} /> : null}</View>
    </Pressable>
  );
};

/** "In wallet: 3,676.84 soUSD ($3,974.28)" */
const describeBalance = (source: RepaySource): string => {
  const where = source.kind === 'wallet' ? 'In wallet' : 'Collateral';
  return `${where}: ${formatRepayTokenAmount(source.balance, source.decimals)} ${source.displaySymbol} (${formatUsd(source.valueUsd)})`;
};

const actionLabel = (quote: ReturnType<typeof quoteRepay> | null): string => {
  if (!quote?.ok) return 'Repay';
  return quote.isFull ? 'Repay all' : `Repay ${formatUsd(quote.repayUsd)}`;
};

/**
 * The one line under the input. A failure from the last attempt wins, then a reason the
 * figure cannot be repaid, then what a valid repayment will do beyond lowering the debt.
 */
const describeQuote = (
  quote: ReturnType<typeof quoteRepay> | null,
  source: RepaySource | null,
  error: string | null,
): { text: string; isError: boolean } | null => {
  if (error) return { text: error, isError: true };
  if (!quote) return null;
  if (!quote.ok) return quote.reason ? { text: quote.reason, isError: true } : null;

  if (quote.isFull) {
    if (quote.returnedCollateral.length === 0) return { text: 'Closes your loan.', isError: false };
    const returned = quote.returnedCollateral
      .map(item => `${formatRepayTokenAmount(item.amount, item.decimals)} ${item.displaySymbol}`)
      .join(' and ');
    return { text: `Closes your loan. ${returned} goes back to your wallet.`, isError: false };
  }

  if (source?.kind === 'collateral') {
    return { text: `Paid from the ${source.displaySymbol} securing your loan.`, isError: false };
  }

  return null;
};

/**
 * The amount field. Styled by hand rather than by class, because on native it is Gorhom's
 * input and not a component NativeWind knows how to style. The face is the one
 * `font-semibold` resolves to everywhere else.
 */
const amountInputStyle: TextStyle = {
  color: '#FFFFFF',
  flex: 1,
  fontFamily: 'MonaSans_600SemiBold',
  fontSize: 40,
  includeFontPadding: false,
  minWidth: 0,
  paddingBottom: 0,
  paddingHorizontal: 0,
  paddingTop: 0,
};

const styles = StyleSheet.create({
  body: { paddingHorizontal: 17 },
  header: { alignItems: 'center', height: 40, justifyContent: 'center' },
  back: {
    alignItems: 'center',
    backgroundColor: '#2B2B2B',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    width: 40,
  },
  loading: {
    alignItems: 'center',
    gap: 16,
    height: LOADING_HEIGHT,
    justifyContent: 'center',
  },
  retry: {
    alignItems: 'center',
    backgroundColor: '#2B2B2B',
    borderRadius: 100,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: { backgroundColor: '#2B2B2B', borderRadius: 20, overflow: 'hidden' },
  summary: { gap: 14, marginTop: HEADER_TO_SUMMARY, paddingHorizontal: 20, paddingVertical: 20 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  input: { marginTop: CARD_GAP, padding: 20 },
  inputRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  amountColumn: { flex: 1, minWidth: 0 },
  amountRow: { alignItems: 'center', flexDirection: 'row', height: 52, marginTop: 8 },
  currency: { marginRight: 2 },
  withColumn: { alignItems: 'flex-end' },
  selector: {
    alignItems: 'center',
    backgroundColor: '#404040',
    borderRadius: 100,
    flexDirection: 'row',
    gap: 8,
    height: 40,
    marginTop: 14,
    paddingLeft: 8,
    paddingRight: 12,
  },
  balanceRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 16 },
  max: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 100,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  maxActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  picker: { marginTop: CARD_GAP, paddingVertical: 6 },
  sourceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 62,
    paddingLeft: 20,
    paddingRight: 16,
  },
  sourceRowDisabled: { opacity: 0.4 },
  sourceText: { flex: 1, gap: 4, marginLeft: 12, minWidth: 0 },
  sourceValue: { alignItems: 'flex-end', gap: 4, marginLeft: 12 },
  check: { alignItems: 'center', marginLeft: 12, width: 18 },
  note: { marginTop: INPUT_TO_NOTE },
  action: {
    alignItems: 'center',
    borderRadius: 100,
    flexDirection: 'row',
    gap: 8,
    height: 50,
    justifyContent: 'center',
    marginTop: NOTE_TO_ACTION,
  },
  // Where the button sits under a one-line note, so it does not jump as a note comes and goes
  // while the cardholder types.
  actionWithoutNote: { marginTop: INPUT_TO_NOTE + NOTE_LINE_HEIGHT + NOTE_TO_ACTION },
  cancel: {
    alignItems: 'center',
    backgroundColor: '#404040',
    borderRadius: 100,
    height: 50,
    justifyContent: 'center',
    marginTop: ACTION_GAP,
  },
});

export default RepaySheetContent;
