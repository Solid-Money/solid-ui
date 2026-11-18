import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import { sheetBodyInset } from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import SheetIconButton from '@/components/Card/NewCardDetails/SpendMode/SheetIconButton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useRainSunset } from '@/hooks/useRainSunset';
import {
  formatClosingBalance,
  formatClosingDate,
  hasClosingBalance,
  isClosingBalanceUnknown,
} from '@/lib/utils/rainSunset';
import { useRainSunsetStore } from '@/store/useRainSunsetStore';

import type { RainSunsetStatus } from '@/lib/types';

const GREEN = '#94F27F';
const AMBER = '#F2B544';
const GREY = 'rgba(255,255,255,0.6)';

/** Figma "4 · What happens next": the sheet body starts 20 below the grabber. */
const SHEET_TOP = 24;
const SHEET_BOTTOM = 40;

/** Long enough for the sheet to finish closing before the next screen slides in. */
const NAVIGATE_AFTER_CLOSE_MS = 250;

interface TimelineStep {
  label: string;
  labelColor: string;
  title: string;
  body: string;
}

/** The three steps, in the order they happen for this user. */
function timeline(sunset: RainSunsetStatus, balanceUsd: number | null): TimelineStep[] {
  const date = formatClosingDate(sunset.closesAt);
  // An unread balance is never "nothing left": say what to do, not how much.
  const toMove = isClosingBalanceUnknown(balanceUsd) || hasClosingBalance(balanceUsd);
  const balance = isClosingBalanceUnknown(balanceUsd)
    ? 'Move your card balance to your wallet.'
    : hasClosingBalance(balanceUsd)
      ? `Move your ${formatClosingBalance(balanceUsd ?? 0)} to your wallet.`
      : 'There is nothing left on this card to move.';

  if (sunset.newCardAvailable) {
    return [
      {
        label: 'Now',
        labelColor: GREEN,
        title: 'Get your new Solid card',
        body: 'Verify once more and get a new virtual card in a few minutes. It spends straight from your wallet.',
      },
      {
        label: date ? `Before ${date.long}` : 'Before your new card is issued',
        labelColor: AMBER,
        title: 'Withdraw your balance',
        body: toMove ? `${balance} Your new card is issued once this one is empty.` : balance,
      },
      {
        label: date ? date.long : 'When your new card is ready',
        labelColor: GREY,
        title: 'This card stops working',
        body: 'Payments, Apple Pay and Google Pay stop. Move any subscriptions to your new card.',
      },
    ];
  }

  return [
    {
      label: 'Now',
      labelColor: GREEN,
      title: 'Withdraw your balance',
      body: balance,
    },
    {
      label: date ? date.long : 'When it closes',
      labelColor: AMBER,
      title: 'Your card stops working',
      body: 'Payments, Apple Pay and Google Pay stop. Move any subscriptions to another card.',
    },
    {
      label: date ? `After ${date.long}` : 'After that',
      labelColor: GREY,
      title: 'Your Solid account keeps working',
      body: "Earn, Send and swaps work as usual. We'll let you know if cards come back to your country.",
    },
  ];
}

const SheetButton = ({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={[styles.button, { backgroundColor: primary ? GREEN : '#2A2A2A' }]}
  >
    <Text className="text-[17px] font-semibold" style={{ color: primary ? '#000000' : '#FFFFFF' }}>
      {label}
    </Text>
  </Pressable>
);

/**
 * "What happens next" for a closing card (Figma "4 · What happens next",
 * 30567:15427): what changes and when, as a three-step timeline, and the one
 * thing to do about it.
 *
 * Mounted once beside Home (which also hosts the card screen), so the Home
 * banner and the card notice open the same sheet.
 */
export const RainClosingSheet = () => {
  const router = useRouter();
  const isOpen = useRainSunsetStore(state => state.isSheetOpen);
  const setOpen = useRainSunsetStore(state => state.setSheetOpen);
  const { sunset, balanceUsd, isBalanceLoading } = useRainSunset();

  if (!sunset) return null;

  const steps = timeline(sunset, balanceUsd);
  const balanceUnknown = isClosingBalanceUnknown(balanceUsd);
  const hasBalance = hasClosingBalance(balanceUsd) || (balanceUnknown && !isBalanceLoading);
  const primary = sunset.newCardAvailable
    ? { label: 'Get your new card', href: path.CARD_NEW_CARD }
    : hasBalance
      ? {
          label: balanceUnknown
            ? 'Withdraw card balance'
            : `Withdraw ${formatClosingBalance(balanceUsd ?? 0)}`,
          href: path.CARD_CLOSING_WITHDRAW,
        }
      : null;

  const go = (href: typeof path.CARD_NEW_CARD) => {
    setOpen(false);
    setTimeout(() => router.push(href), NAVIGATE_AFTER_CLOSE_MS);
  };

  return (
    <CardBottomSheet
      isOpen={isOpen}
      onOpenChange={setOpen}
      contentKey="rain-closing"
      designTop={SHEET_TOP}
      designBottom={SHEET_BOTTOM}
      scrollable
    >
      {({ topPadding, presentation }) => (
        <View
          style={[
            styles.sheet,
            { paddingTop: topPadding, paddingHorizontal: sheetBodyInset(presentation) },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text
                accessibilityRole="header"
                className="text-[24px] font-semibold leading-[30px] text-white"
              >
                Your card is closing
              </Text>
              <Text className="text-[15px] leading-[20px] text-white/60">
                Here’s what changes and when.
              </Text>
            </View>
            {presentation === 'modal' && (
              <SheetIconButton
                icon="close"
                accessibilityLabel="Close"
                onPress={() => setOpen(false)}
              />
            )}
          </View>

          <View>
            {steps.map((step, index) => {
              const last = index === steps.length - 1;
              return (
                <View key={step.title} style={styles.step}>
                  <View style={styles.rail}>
                    <View style={[styles.dot, { backgroundColor: step.labelColor }]} />
                    {!last && <View style={styles.line} />}
                  </View>
                  <View style={[styles.stepText, !last && styles.stepGap]}>
                    <Text className="text-[13px] font-semibold" style={{ color: step.labelColor }}>
                      {step.label}
                    </Text>
                    <Text className="text-[17px] font-semibold text-white">{step.title}</Text>
                    <Text className="text-[14px] leading-[20px] text-white/70">{step.body}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.buttons}>
            {primary ? (
              <SheetButton label={primary.label} primary onPress={() => go(primary.href)} />
            ) : null}
            <SheetButton label="Got it" primary={false} onPress={() => setOpen(false)} />
          </View>
        </View>
      )}
    </CardBottomSheet>
  );
};

const styles = StyleSheet.create({
  sheet: { gap: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heading: { flex: 1, gap: 6 },
  step: { flexDirection: 'row', gap: 14 },
  rail: { alignItems: 'center', paddingTop: 5 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  line: { flex: 1, width: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  stepText: { flex: 1, gap: 3 },
  stepGap: { paddingBottom: 20 },
  buttons: { gap: 10, paddingTop: 8 },
  button: {
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RainClosingSheet;
