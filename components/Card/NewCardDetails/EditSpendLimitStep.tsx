import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import Input from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  dailyLimitFor,
  monthlyLimitFor,
  onChainToUsd,
  parseUsdInput,
  spendLimitRejection,
  usdToOnChain,
} from '@/constants/cardSpendModule';
import { CardSpendLimit } from '@/hooks/useCardSpendRegistration';

/** Which of the two rolling windows is being edited. */
export type SpendLimitField = 'daily' | 'monthly';

interface EditSpendLimitStepProps {
  field: SpendLimitField;
  /** The caps in force. Both are needed: each edit is validated against the other. */
  limit: CardSpendLimit;
  /** Live org maximums, which bind only in the raising direction. */
  ceilings: { maxDailyLimitUsd: bigint; maxMonthlyLimitUsd: bigint };
  /**
   * Whether Confirm is the press that registers the Safe and enables the module, rather
   * than moving a cap that already exists. Decides where the *other* cap comes from:
   * `registerSafe` writes both, so before registration a monthly limit has to produce a
   * daily one instead of leaving the stored zero in place.
   */
  willEnableSpending: boolean;
  isSubmitting: boolean;
  /**
   * Called with the whole pair, in whole dollars — the edited cap and whatever the other
   * one becomes. Passing both means what was previewed here is exactly what gets signed,
   * with no second derivation on the way to the contract.
   */
  onConfirm: (next: { dailyLimitUsd: number; monthlyLimitUsd: number }) => void;
}

/**
 * The one-field limit editor (Figma 25601:2658), and the only place a cap is chosen.
 *
 * A field rather than a row of presets: the cardholder usually wants a specific number,
 * and a preset list either cannot express it or has to be filtered against the live org
 * ceilings and then still explain why an option vanished. The thing presets bought — that
 * a typo cannot cost a failed user operation — is paid for here instead by validating
 * against `spendLimitRejection`, the same helper the hook re-checks with immediately
 * before it signs, so a value the module would refuse never reaches a signature prompt.
 *
 * The same screen does first-time setup, because the question is identical: an
 * unregistered Safe has a daily cap of zero and naming one is what `registerSafe` writes.
 * {@link EditSpendLimitStepProps.willEnableSpending} is what makes that press say what it
 * grants.
 */
const EditSpendLimitStep = ({
  field,
  limit,
  ceilings,
  willEnableSpending,
  isSubmitting,
  onConfirm,
}: EditSpendLimitStepProps) => {
  const isDaily = field === 'daily';
  const currentUsd = isDaily ? limit.dailyLimitUsd : limit.monthlyLimitUsd;
  // Prefilled with the cap in force so Confirm is inert until something actually moves: a
  // button that signs a transaction changing nothing is worse than a disabled one. An
  // unregistered Safe stores zero, which is not a limit anyone meant to set, so the field
  // starts empty there instead of on a number the user would have to clear.
  const [text, setText] = useState(() => (currentUsd > 0n ? String(onChainToUsd(currentUsd)) : ''));

  const dollars = parseUsdInput(text);
  // The exact pair the hook will send, so what is validated here is what gets signed.
  //
  // The cap not being edited stays where it is: the two are independent decisions and
  // moving one because the other moved would change a number the user did not touch. The
  // exception is registration, where there is no stored value to leave alone and
  // `registerSafe` has to write both — there the untouched one comes off
  // `MONTHLY_LIMIT_MULTIPLIER`, the same relationship card activation registers with.
  const typed = dollars === null ? null : usdToOnChain(dollars);
  const next =
    typed === null
      ? null
      : isDaily
        ? {
            dailyLimitUsd: typed,
            monthlyLimitUsd: willEnableSpending ? monthlyLimitFor(typed) : limit.monthlyLimitUsd,
          }
        : {
            dailyLimitUsd: willEnableSpending ? dailyLimitFor(typed) : limit.dailyLimitUsd,
            monthlyLimitUsd: typed,
          };

  const rejection = next === null ? null : spendLimitRejection(limit, next, ceilings, field);
  const isUnchanged =
    next !== null &&
    next.dailyLimitUsd === limit.dailyLimitUsd &&
    next.monthlyLimitUsd === limit.monthlyLimitUsd;

  return (
    <View>
      <Text className="text-[16px] font-medium text-white/50">
        {isDaily ? 'Daily limit' : 'Monthly limit'}
      </Text>
      <Input
        // No border class here on purpose: `Input` already sets a transparent one, and
        // anything passed in this slot lands after its `error` border and would hide it.
        className="mt-4 h-[54px] rounded-[15px] bg-popover px-5 text-[16px] font-medium"
        keyboardType="number-pad"
        inputMode="numeric"
        value={text}
        onChangeText={setText}
        editable={!isSubmitting}
        error={rejection !== null}
        autoFocus
        accessibilityLabel={isDaily ? 'Daily limit in dollars' : 'Monthly limit in dollars'}
        selectTextOnFocus
      />
      {/* The only copy under the field, and only while it applies: without it a value
          the module would refuse leaves Confirm disabled for no stated reason. */}
      {rejection ? (
        <Text className="mt-3 text-[14px] leading-snug text-red-400">{rejection}</Text>
      ) : null}
      <Button
        variant="brand"
        className="mt-8 h-[50px] w-full rounded-full border-0"
        disabled={isSubmitting || next === null || rejection !== null || isUnchanged}
        onPress={() =>
          next !== null &&
          onConfirm({
            dailyLimitUsd: onChainToUsd(next.dailyLimitUsd),
            monthlyLimitUsd: onChainToUsd(next.monthlyLimitUsd),
          })
        }
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="black" />
        ) : (
          <Text className="text-[16px] font-semibold text-black">Confirm</Text>
        )}
      </Button>
    </View>
  );
};

export default EditSpendLimitStep;
