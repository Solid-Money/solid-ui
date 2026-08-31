import { ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Check, ShieldCheck } from 'lucide-react-native';

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
  DAILY_LIMIT_PRESETS_USD,
  formatUsd,
  MONTHLY_LIMIT_MULTIPLIER,
  usdToOnChain,
} from '@/constants/cardSpendModule';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';

interface RegisterSpendActionProps {
  /** The circular action rendered in the card's action row. */
  trigger: ReactNode;
}

/**
 * First-time setup for a Wirex card backed by `SolidCashModule`.
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
    canDisable,
    isDisabling,
    error,
    register,
    disable,
  } = useCardSpendRegistration();

  // Only offer what the module would actually accept. An option that reverts with
  // ExceedsOrgDailyCeiling is worse than an option that isn't there.
  const presets = useMemo(() => {
    if (!registration) return [];
    return DAILY_LIMIT_PRESETS_USD.filter(dollars => {
      const daily = usdToOnChain(dollars);
      return (
        daily <= registration.maxDailyLimitUsd &&
        daily * MONTHLY_LIMIT_MULTIPLIER <= registration.maxMonthlyLimitUsd
      );
    });
  }, [registration]);

  // Default to the largest the org allows rather than the smallest: a cap that is too
  // low shows up as a declined card at the till, which is the worse failure.
  const daily = selectedDaily ?? presets.at(-1) ?? null;
  const monthly = daily === null ? null : daily * Number(MONTHLY_LIMIT_MULTIPLIER);

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
      setIsOpen(false);
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
      setIsConfirmingDisable(false);
      setIsOpen(false);
    } catch {
      // `error` from the hook renders in the sheet; the user stays here to retry.
    }
  };

  const title = isRegistered
    ? 'Card spending is on'
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
          setIsOpen(next);
          if (!next) setIsConfirmingDisable(false);
        }}
      >
        <DialogContent className="border-0 bg-[#1C1C1C] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white">{title}</DialogTitle>
            <DialogDescription className="text-base leading-tight text-[#ACACAC]">
              {isRegistered
                ? 'Your card spends straight from savings, inside the limits below. You can turn this off any time from your wallet.'
                : isRevoked
                  ? 'You turned card spending off, so payments will be declined. Your limits are still saved — turning it back on restores them.'
                  : 'Your savings are your card balance. Set a daily limit and your card can spend up to it without asking again — nothing moves until you pay with the card.'}
            </DialogDescription>
          </DialogHeader>

          {isPaused ? (
            <View className="mt-3 rounded-2xl bg-[#2A2119] p-4">
              <Text className="text-sm text-[#E8A33D]">
                Card spending is paused on your account right now. Please contact support before
                setting up.
              </Text>
            </View>
          ) : null}

          {/* Limit picker: only for a first-time setup. Once registered the caps are
              on-chain state, and changing them is a different action with different
              rules — a decrease applies immediately, an increase is delayed. */}
          {!isRegistered && !isRevoked && presets.length > 0 ? (
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
                      disabled={isRegistering}
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
            </View>
          ) : null}

          <View className="mt-4 gap-3 rounded-2xl bg-[#252525] p-4">
            {daily !== null && <Row label="Daily limit" value={formatUsd(usdToOnChain(daily))} />}
            {monthly !== null && (
              <Row label="Monthly limit" value={formatUsd(usdToOnChain(monthly))} />
            )}
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
                Your card can take stablecoins and savings from your Safe up to these limits without
                asking again. Nothing else can — payments only ever go to Solid&apos;s settlement
                account. Turn it off any time and it stops immediately.
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
              <View className="mt-5 flex-row items-center justify-center gap-2">
                <Check size={18} color="#94F27F" />
                <Text className="text-base font-bold text-[#94F27F]">Set up</Text>
              </View>
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
                    disabled={isDisabling}
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
                    One signature removes the module from your Safe. Nothing can be taken from your
                    savings by the card after that.
                  </Text>
                </>
              ) : null}
            </>
          ) : (
            <Button
              variant="brand"
              className="mt-5 h-12 w-full rounded-xl border-0"
              disabled={isRegistering || isPaused || daily === null}
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
