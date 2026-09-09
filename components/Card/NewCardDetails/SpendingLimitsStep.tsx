import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatUsd, formatWindowRefresh } from '@/constants/cardSpendModule';
import { CardSpendLimit } from '@/hooks/useCardSpendRegistration';

interface LimitRowProps {
  label: string;
  /** The cap in force, on-chain scale. Zero before the Safe is registered. */
  limitUsd: bigint;
  /** Spent against it inside the current window. */
  spentUsd: bigint;
  /** Unix seconds the window resets on. */
  renewalAt: bigint;
  onEdit: () => void;
  disabled: boolean;
}

/**
 * One rolling window: its cap, what is left under it, and when it resets
 * (Figma 25601:2640).
 *
 * The bar fills with what is **left**, not what has been spent. Both readings are
 * defensible for a quota, but the number directly beneath it is the remainder, and a
 * green bar that empties as the day goes on is the one people already know from a fuel
 * gauge — a green bar that fills as you spend would read as progress towards something
 * good.
 *
 * A cap of zero is an unregistered Safe rather than a cardholder with no headroom, so the
 * bar and the window copy are dropped: there is no window to describe until the module
 * has been given one.
 */
const LimitRow = ({ label, limitUsd, spentUsd, renewalAt, onEdit, disabled }: LimitRowProps) => {
  // Clamped rather than trusted: the module books a spend against both windows and the
  // caps can be lowered underneath an amount already spent, so `spent > limit` is a real
  // state and it means nothing is left, not that a negative amount is.
  const remaining = limitUsd > spentUsd ? limitUsd - spentUsd : 0n;
  const remainingPercent = limitUsd > 0n ? Number((remaining * 100n) / limitUsd) : 0;

  return (
    <View>
      <View className="flex-row items-center">
        <View className="flex-1">
          <Text className="text-[16px] font-medium text-white/70">{label}</Text>
          <Text className="mt-1 text-[18px] font-bold text-white">{formatUsd(limitUsd)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${label.toLowerCase()}`}
          disabled={disabled}
          onPress={onEdit}
          style={styles.editChip}
          className="transition-all active:scale-95 active:opacity-80"
        >
          <Text className="text-[14px] font-medium text-black">Edit</Text>
        </Pressable>
      </View>
      {limitUsd > 0n ? (
        <>
          <View style={styles.track} className="mt-3 bg-white/20">
            <View style={[styles.fill, { width: `${remainingPercent}%` }]} className="bg-brand" />
          </View>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-[14px] text-white/70">{formatUsd(remaining)} remaining</Text>
            <Text className="text-[14px] text-white/70">{formatWindowRefresh(renewalAt)}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
};

interface SpendingLimitsStepProps {
  limit: CardSpendLimit;
  /**
   * Whether the Safe has registered. Registration is permanent and independent of module
   * consent, so this is what decides whether there are stored caps to move at all.
   */
  isRegisteredOnChain: boolean;
  /** Whether the module is live on the Safe — i.e. whether the card can actually spend. */
  isModuleEnabled: boolean;
  /** Guardian pause, global or per-Safe. Nothing can be granted while it holds. */
  isPaused: boolean;
  isEnabling: boolean;
  isDisabling: boolean;
  /** Any write in flight — the chips and both switches wait on the same signature. */
  isBusy: boolean;
  onEditDaily: () => void;
  onEditMonthly: () => void;
  onEnable: () => void;
  onDisable: () => void;
}

/**
 * The spending-limits screen of the manage-card sheet (Figma 25601:2557), and the only
 * place card spending is set up, changed or turned off.
 *
 * It shows the two caps the module enforces and the headroom left under each, because
 * those are the two numbers that decide whether the next payment goes through. There is
 * no separate setup screen: an unregistered Safe has no caps, so both read $0 and setting
 * the daily one is the press that registers and enables the module. That way there is one
 * screen to learn rather than two that say nearly the same thing.
 *
 * Both caps are editable, in both states. The contract stores them independently and an
 * org's defaults do not always leave them ten times apart, so a cardholder who wants to
 * move only the monthly must be able to; and before registration `registerSafe` writes
 * the pair, so either row can be the one they name first — see `EditSpendLimitStep` for
 * how the other one follows.
 */
const SpendingLimitsStep = ({
  limit,
  isRegisteredOnChain,
  isModuleEnabled,
  isPaused,
  isEnabling,
  isDisabling,
  isBusy,
  onEditDaily,
  onEditMonthly,
  onEnable,
  onDisable,
}: SpendingLimitsStepProps) => {
  return (
    <View>
      <LimitRow
        label="Daily Limit"
        limitUsd={limit.dailyLimitUsd}
        spentUsd={limit.spentTodayUsd}
        renewalAt={limit.dailyRenewalTimestamp}
        onEdit={onEditDaily}
        disabled={isBusy}
      />
      <View className="mt-8">
        <LimitRow
          label="Monthly Limit"
          limitUsd={limit.monthlyLimitUsd}
          spentUsd={limit.spentThisMonthUsd}
          renewalAt={limit.monthlyRenewalTimestamp}
          onEdit={onEditMonthly}
          disabled={isBusy}
        />
      </View>

      {isModuleEnabled ? (
        <View className="mt-10">
          <Button
            variant="secondary"
            className="h-[50px] w-full rounded-full border-0 bg-[#2B2B2B]"
            disabled={isBusy}
            onPress={onDisable}
          >
            {isDisabling ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-[16px] font-semibold text-white">Turn card spending off</Text>
            )}
          </Button>
        </View>
      ) : (
        // Two states share this branch, and they are one press apart: never registered
        // (no caps, so set the daily one) and registered-then-revoked (caps saved, so put
        // them back in force). Both end with the module enabled on the Safe.
        //
        // Just the caps and the button, as the design has it.
        <View className="mt-10">
          <Button
            variant="brand"
            className="h-[50px] w-full rounded-full border-0"
            disabled={isBusy || isPaused}
            onPress={isRegisteredOnChain ? onEnable : onEditDaily}
          >
            {isEnabling ? (
              <ActivityIndicator size="small" color="black" />
            ) : (
              <Text className="text-[16px] font-semibold text-black">
                {isRegisteredOnChain ? 'Turn card spending back on' : 'Set a daily limit'}
              </Text>
            )}
          </Button>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  editChip: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 100,
    height: 30,
    justifyContent: 'center',
    width: 62,
  },
  track: { borderRadius: 10, height: 10, overflow: 'hidden' },
  fill: { borderRadius: 10, height: 10 },
});

export default SpendingLimitsStep;
