import { ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Check, Clock, ShieldCheck } from 'lucide-react-native';

import SlotTrigger from '@/components/SlotTrigger';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import {
  formatActivationTime,
  formatDelayDuration,
  formatUsd,
  monthlyLimitFor,
  offerableDailyPresets,
  onChainToUsd,
  usdToOnChain,
} from '@/constants/cardSpendModule';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';

interface RegisterSpendActionProps {
  /** The circular action rendered in the card's action row. */
  trigger: ReactNode;
}

/**
 * Card spending for a Wirex card backed by `SolidCashModule`: setting it up, changing
 * the limits afterwards, and turning it off.
 *
 * ## What the user is actually agreeing to
 *
 * A Wirex card holds no balance. Wirex pays the merchant and our backend debits the
 * user's Safe afterwards — USDC first, then USDT, then soUSD — so what they hold *is*
 * their card balance. To make that possible they enable a Safe module and register
 * spending limits: one signature covering both, because `registerSafe` and
 * `Safe.enableModule` each require the Safe itself as sender.
 *
 * This is a bigger grant than the ERC-20 allowance flow it replaced, so the sheet says
 * so plainly: the module can take those assets without a further signature, bounded by
 * the caps chosen here, and the user can switch it off at any time. Describing it as
 * "authorize once" would understate it.
 *
 * ## Why limits are presets and the timezone is never asked
 *
 * The caps have to satisfy three on-chain constraints at once (`daily <= monthly`,
 * `daily <= maxDailyLimitUsd`, `monthly <= maxMonthlyLimitUsd`), and the monthly is
 * derived from the daily so the first can never be violated. Presets above the live org
 * ceiling are filtered out rather than offered and then rejected.
 *
 * The rolling windows reset on a timezone offset that is written once and has no setter,
 * so it is read from the device rather than asked for — a permanent answer to a question
 * the user cannot usefully answer.
 *
 * ## Why changing a limit reads as two different actions
 *
 * The picker is one control, but the contract is not: lowering a cap shrinks the
 * module's authority and lands immediately, while raising one widens what a compromised
 * backend key could take and therefore only *arms*, maturing after `limitRaiseDelay`.
 * The button says which of the two is about to happen, because "your limit is now $500"
 * would be false for the next day on the raise path — and a user who believed it would
 * find their card declining at the till.
 */
const RegisterSpendAction = ({ trigger }: RegisterSpendActionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDaily, setSelectedDaily] = useState<number | null>(null);
  // Turning spending off declines the card at the till, so the destructive button asks
  // once before it signs. Local to the sheet, and cleared whenever it closes, so a
  // half-confirmed state is never what greets the user next time.
  const [isConfirmingDisable, setIsConfirmingDisable] = useState(false);
  const {
    registration,
    isRegistered,
    isRevoked,
    isPaused,
    isRegistering,
    isUpdatingLimit,
    isCancellingIncrease,
    canDisable,
    isDisabling,
    limit,
    pendingIncrease,
    error,
    register,
    updateLimit,
    cancelPendingIncrease,
    disable,
  } = useCardSpendRegistration();

  const isBusy = isRegistering || isUpdatingLimit || isCancellingIncrease || isDisabling;

  /** The daily cap in force right now, in whole dollars, once there is one. */
  const currentDaily = useMemo(
    () => (registration?.registeredOnChain && limit ? onChainToUsd(limit.dailyLimitUsd) : null),
    [registration?.registeredOnChain, limit],
  );

  // Only offer what the module would actually accept. An option that reverts with
  // ExceedsOrgDailyCeiling is worse than an option that isn't there.
  //
  // The limit already in force is always in the list even when the org has since lowered
  // a ceiling below it: it is the value to come back to after changing your mind, and a
  // picker with no option selected reads as though the current setting were unknown.
  const presets = useMemo(() => {
    if (!registration) return [];
    const offerable = offerableDailyPresets(registration);
    if (currentDaily === null || offerable.includes(currentDaily)) return offerable;
    return [...offerable, currentDaily].sort((a, b) => a - b);
  }, [registration, currentDaily]);

  // Before setup, default to the largest the org allows rather than the smallest: a cap
  // that is too low shows up as a declined card at the till, which is the worse failure.
  // Afterwards, default to what is actually in force — this is an edit, and an edit
  // starts from the current value.
  const daily = selectedDaily ?? currentDaily ?? presets.at(-1) ?? null;
  // The same derivation the hook signs with, so the previewed monthly is the one sent.
  const monthly = useMemo(
    () =>
      daily === null
        ? null
        : monthlyLimitFor(usdToOnChain(daily), currentDaily === null ? null : limit),
    [daily, limit, currentDaily],
  );

  const isChangingLimit =
    isRegistered && currentDaily !== null && daily !== null && daily !== currentDaily;
  const isRaisingLimit = isChangingLimit && daily > (currentDaily ?? 0);
  // The selection is the raise already waiting out its delay. Sending it again is a
  // signature that changes nothing except to restart the clock on it.
  const isAlreadyRequested = Boolean(
    pendingIncrease && daily !== null && usdToOnChain(daily) === pendingIncrease.dailyLimitUsd,
  );

  const closeSheet = () => {
    setIsOpen(false);
    setIsConfirmingDisable(false);
    // The picker is an edit of on-chain state, so it must not carry a choice across
    // openings — a stale selection would show a limit the card does not have.
    setSelectedDaily(null);
  };

  const handleRegister = async () => {
    if (daily === null) return;
    try {
      // False means the user dismissed the signature prompt — nothing was enabled, so
      // saying "set up" would be a lie. Leave the sheet open and say nothing.
      if (!(await register(daily))) return;
      Toast.show({
        type: 'success',
        text1: isRevoked ? 'Card spending re-enabled' : 'Card spending is set up',
        text2: `Your card can spend up to ${formatUsd(usdToOnChain(daily))} a day from savings.`,
        props: { badgeText: '' },
      });
      closeSheet();
    } catch {
      // `error` from the hook renders in the sheet; the user stays here to retry.
    }
  };

  const handleUpdateLimit = async () => {
    if (daily === null) return;
    try {
      const result = await updateLimit(daily);
      // Null means the signature prompt was dismissed and the caps did not move.
      if (!result) return;
      Toast.show({
        type: 'success',
        text1: result.isIncrease ? 'Higher limit requested' : 'Daily limit lowered',
        text2: result.isIncrease
          ? `${formatUsd(usdToOnChain(daily))} a day takes effect ${
              result.activatesAt ? `on ${formatActivationTime(result.activatesAt)}` : 'shortly'
            }. Until then your current limit applies.`
          : `Your card can now spend up to ${formatUsd(usdToOnChain(daily))} a day.`,
        props: { badgeText: '' },
      });
      closeSheet();
    } catch {
      // `error` from the hook renders in the sheet; the user stays here to retry.
    }
  };

  const handleCancelIncrease = async () => {
    try {
      if (!(await cancelPendingIncrease())) return;
      Toast.show({
        type: 'success',
        text1: 'Limit change cancelled',
        text2: 'Your current daily limit stays as it is.',
        props: { badgeText: '' },
      });
    } catch {
      // `error` from the hook renders in the sheet; the user stays here to retry.
    }
  };

  const handleDisable = async () => {
    try {
      // False means the signature prompt was dismissed — the module is still enabled and
      // the card still spends, so the sheet stays as it was.
      if (!(await disable())) return;
      Toast.show({
        type: 'success',
        text1: 'Card spending is off',
        text2: 'Your card will decline until you turn it back on. Your limits are saved.',
        props: { badgeText: '' },
      });
      closeSheet();
    } catch {
      // `error` from the hook renders in the sheet; the user stays here to retry.
    }
  };

  const title = isRegistered
    ? 'Card spending'
    : isRevoked
      ? 'Card spending is off'
      : 'Set up card spending';

  return (
    <>
      {/* SlotTrigger, not DialogTrigger asChild: the trigger is a CircleAction whose own
          padding/label styling lives on its root Pressable, and the asChild Slot chain
          drops those classes. SlotTrigger clones and merges onPress instead. */}
      <SlotTrigger onPress={() => setIsOpen(true)}>{trigger}</SlotTrigger>
      <Dialog
        open={isOpen}
        onOpenChange={next => {
          if (next) setIsOpen(true);
          else closeSheet();
        }}
      >
        <DialogContent className="border-0 bg-[#1C1C1C] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white">{title}</DialogTitle>
            <DialogDescription className="text-base leading-tight text-[#ACACAC]">
              {isRegistered
                ? 'Your card spends straight from savings, inside the limits below. Change them or turn spending off whenever you like.'
                : isRevoked
                  ? 'You turned card spending off, so payments will be declined. Your limits are still saved — turning it back on restores them.'
                  : 'Your savings are your card balance. Set a daily limit and your card can spend up to it without asking again — nothing moves until you pay with the card.'}
            </DialogDescription>
          </DialogHeader>

          {/* Scrolls because the registered state stacks a picker, a summary, a pending
              change and the off switch — more than a short phone fits. */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {isPaused ? (
              <View className="mt-3 rounded-2xl bg-[#2A2119] p-4">
                <Text className="text-sm text-[#E8A33D]">
                  Card spending is paused on your account right now. Please contact support before
                  setting up.
                </Text>
              </View>
            ) : null}

            {/* A raise that has not matured yet. Shown before the picker because it
                changes what the numbers underneath mean: the limits below are still the
                ones in force, and this is what replaces them and when. */}
            {pendingIncrease ? (
              <View className="mt-4 flex-row gap-2 rounded-2xl bg-[#241F14] p-4">
                <Clock size={18} color="#E8A33D" style={styles.noticeIcon} />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-[#E8A33D]">
                    {formatUsd(pendingIncrease.dailyLimitUsd)} a day starts{' '}
                    {formatActivationTime(pendingIncrease.activatesAt)}
                  </Text>
                  <Text className="mt-1 text-xs leading-snug text-[#ACACAC]">
                    Higher limits wait before they take effect, so an increase you did not ask for
                    can be stopped. Until then your current limit applies.
                  </Text>
                  <Pressable
                    className="mt-2 self-start"
                    disabled={isBusy}
                    onPress={handleCancelIncrease}
                  >
                    <Text className="text-sm font-semibold text-white underline">
                      {isCancellingIncrease ? 'Cancelling…' : 'Cancel this change'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* The picker: first-time setup, or an edit of a live registration. Hidden in
                the revoked state, where the saved limits are restored as they were and
                the only decision is whether to turn spending back on. */}
            {!isRevoked && presets.length > 0 ? (
              <View className="mt-4">
                <Text className="mb-2 text-sm font-medium text-[#ACACAC]">Daily limit</Text>
                <View style={styles.presetRow}>
                  {presets.map(dollars => {
                    const isSelected = dollars === daily;
                    return (
                      <Pressable
                        key={dollars}
                        accessibilityLabel={`Daily limit ${formatUsd(usdToOnChain(dollars))}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        disabled={isBusy}
                        onPress={() => setSelectedDaily(dollars)}
                        style={[styles.preset, isSelected ? styles.presetSelected : null]}
                        className="transition-all active:scale-95"
                      >
                        <Text
                          className={
                            isSelected
                              ? 'text-sm font-bold text-black'
                              : 'text-sm font-semibold text-white'
                          }
                        >
                          {formatUsd(usdToOnChain(dollars))}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {isChangingLimit ? (
                  <Text className="mt-2 text-xs leading-snug text-[#ACACAC]">
                    {isRaisingLimit
                      ? `Higher limits take effect after ${formatDelayDuration(
                          registration?.limitRaiseDelaySeconds ?? 0,
                        )}. Your current limit applies until then.`
                      : pendingIncrease
                        ? // The contract drops a pending raise on any decrease, so the
                          // user is agreeing to two things with one button.
                          'Lowering takes effect straight away, and drops the increase waiting above.'
                        : 'Lower limits take effect straight away.'}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View className="mt-4 gap-3 rounded-2xl bg-[#252525] p-4">
              {/* In the revoked state the picker is hidden, so these are the saved
                  on-chain caps that turning spending back on restores — not a choice. */}
              {daily !== null && (
                <Row
                  label={isChangingLimit ? 'New daily limit' : 'Daily limit'}
                  value={formatUsd(usdToOnChain(daily))}
                />
              )}
              {monthly !== null && (
                <Row
                  label={isChangingLimit ? 'New monthly limit' : 'Monthly limit'}
                  value={formatUsd(monthly)}
                />
              )}
              {isRegistered && limit ? (
                <Row label="Spent today" value={formatUsd(limit.spentTodayUsd)} />
              ) : null}
              {registration ? (
                <Row label="Max per payment" value={formatUsd(registration.maxPerTxUsd)} />
              ) : null}
            </View>

            {/* Stated up front, not buried: this grant lets funds leave the Safe without a
                further signature. The caps and the off-switch are what make that
                acceptable, so they are named in the same breath. */}
            {!isRegistered ? (
              <View className="mt-3 flex-row gap-2 rounded-2xl bg-[#1F2419] p-3">
                <ShieldCheck size={18} color="#94F27F" style={styles.noticeIcon} />
                <Text className="flex-1 text-xs leading-snug text-[#ACACAC]">
                  Your card can take stablecoins and savings from your Safe up to these limits
                  without asking again. Nothing else can — payments only ever go to Solid&apos;s
                  settlement account. Turn it off any time and it stops immediately.
                </Text>
              </View>
            ) : null}

            {registration && presets.length === 0 && !isRegistered && !isRevoked ? (
              <Text className="mt-3 text-sm text-[#E8A33D]">
                Card spending limits are not open on your account yet. Please try again later.
              </Text>
            ) : null}

            {error ? <Text className="mt-3 text-sm text-red-400">{error}</Text> : null}

            {isRegistered ? (
              <>
                {isAlreadyRequested ? (
                  <Text className="mt-5 text-center text-sm text-[#ACACAC]">
                    That change is already requested — it takes effect on{' '}
                    {formatActivationTime(pendingIncrease!.activatesAt)}.
                  </Text>
                ) : isChangingLimit ? (
                  <Button
                    variant="brand"
                    className="mt-5 h-12 w-full rounded-xl border-0"
                    disabled={isBusy}
                    onPress={handleUpdateLimit}
                  >
                    {isUpdatingLimit ? (
                      <ActivityIndicator size="small" color="black" />
                    ) : (
                      <Text className="text-base font-bold text-black">
                        {isRaisingLimit
                          ? `Request ${formatUsd(usdToOnChain(daily))} a day`
                          : `Lower to ${formatUsd(usdToOnChain(daily))} a day`}
                      </Text>
                    )}
                  </Button>
                ) : (
                  <View className="mt-5 flex-row items-center justify-center gap-2">
                    <Check size={18} color="#94F27F" />
                    <Text className="text-base font-bold text-[#94F27F]">Spending is on</Text>
                  </View>
                )}
                {/* Only when the module is actually live. In the revoked state it is already
                    off and the action above is "turn it back on", so an off switch there
                    would be a button that cannot do anything. */}
                {canDisable ? (
                  <>
                    {isConfirmingDisable ? (
                      <Text className="mt-4 text-center text-sm text-[#ACACAC]">
                        Your card will decline every payment until you turn spending back on. Your
                        daily limit stays saved.
                      </Text>
                    ) : null}
                    <Button
                      variant={isConfirmingDisable ? 'destructive' : 'outline'}
                      className="mt-4 h-12 w-full rounded-xl"
                      disabled={isBusy}
                      onPress={
                        isConfirmingDisable ? handleDisable : () => setIsConfirmingDisable(true)
                      }
                    >
                      {isDisabling ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text className="text-base font-bold text-white">
                          {isConfirmingDisable
                            ? 'Yes, turn card spending off'
                            : 'Turn card spending off'}
                        </Text>
                      )}
                    </Button>
                    {isConfirmingDisable ? (
                      <Pressable
                        className="mt-2 self-center px-3 py-2"
                        disabled={isDisabling}
                        onPress={() => setIsConfirmingDisable(false)}
                      >
                        <Text className="text-sm text-[#ACACAC]">Keep it on</Text>
                      </Pressable>
                    ) : null}
                    <Text className="mt-3 text-center text-xs text-[#6F6F6F]">
                      One signature removes the module from your Safe. Nothing can be taken from
                      your savings by the card after that.
                    </Text>
                  </>
                ) : null}
              </>
            ) : (
              <Button
                variant="brand"
                className="mt-5 h-12 w-full rounded-xl border-0"
                disabled={isBusy || isPaused || daily === null}
                onPress={handleRegister}
              >
                {isRegistering ? (
                  <ActivityIndicator size="small" color="black" />
                ) : (
                  <Text className="text-base font-bold text-black">
                    {isRevoked
                      ? 'Turn card spending back on'
                      : daily === null
                        ? 'Set up card spending'
                        : `Enable ${formatUsd(usdToOnChain(daily))} a day`}
                  </Text>
                )}
              </Button>
            )}

            {!isRegistered && !isRevoked ? (
              <Text className="mt-3 text-center text-xs text-[#6F6F6F]">
                One signature enables the module and saves your limits.
              </Text>
            ) : null}
          </ScrollView>
        </DialogContent>
      </Dialog>
    </>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text className="text-sm text-[#ACACAC]">{label}</Text>
    <Text className="text-sm font-semibold text-white">{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  // Bounded so the sheet scrolls instead of growing past the screen, and shrinkable so a
  // dialog shorter than the bound still contains it.
  body: { flexShrink: 1, maxHeight: 520 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    justifyContent: 'center',
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  presetSelected: { backgroundColor: '#94F27F' },
  noticeIcon: { marginTop: 1 },
});

export default RegisterSpendAction;
