import { StyleSheet, View } from 'react-native';
import { format } from 'date-fns';

import CopyToClipboard from '@/components/CopyToClipboard';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { VirtualAccountMicroDeposit } from '@/lib/types';

import { CopyFieldIcon } from './icons';

/** Rain's minimum for a bank deposit to be converted and credited. */
export const VIRTUAL_ACCOUNT_MINIMUM_DEPOSIT_USD = 2;

/**
 * "0.23" → "0.23". Rain sends dollars, not cents, and a bank asks for the exact
 * figure, so the string is normalised to two places rather than run through a
 * currency formatter that might round or localise it.
 */
export const formatMicroDepositAmount = (amount: string): string => {
  const value = Number(amount);
  return Number.isFinite(value) ? value.toFixed(2) : amount;
};

const formatReceivedAt = (receivedAt: string): string => {
  const date = new Date(receivedAt);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'MMM d');
};

/** One verification amount, with the copy affordance the bank form needs. */
const MicroDepositRow = ({
  deposit,
  withDivider,
}: {
  deposit: VirtualAccountMicroDeposit;
  withDivider: boolean;
}) => {
  const amount = formatMicroDepositAmount(deposit.amount);
  const receivedOn = formatReceivedAt(deposit.receivedAt);
  const detail = [deposit.originatorName, receivedOn].filter(Boolean).join(' · ');

  return (
    <View>
      <View className="flex-row items-center" style={styles.row}>
        <View className="flex-1 gap-0.5">
          <Text className="text-[16px] font-medium leading-[23px] text-white">${amount}</Text>
          {detail ? (
            <Text className="text-[14px] leading-5 text-white/70" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
          {!deposit.isAccountVerification && (
            <Text className="text-[12px] leading-4 text-white/50">Too small to process</Text>
          )}
        </View>
        <CopyToClipboard
          text={amount}
          icon={<CopyFieldIcon />}
          className="opacity-50"
          size={18}
          onCopy={() =>
            track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_MICRO_DEPOSIT_COPIED, {
              is_account_verification: deposit.isAccountVerification,
              rail: deposit.rail,
            })
          }
        />
      </View>
      {withDivider && <View style={styles.divider} />}
    </View>
  );
};

/**
 * The $2 minimum, and the small deposits that fell under it.
 *
 * A bank or broker that links an account by sending a few cents asks the user to
 * type those amounts back. Rain never converts a deposit under $2, so before
 * this they reached no balance and no screen — the user had no way to finish
 * the check. This is where they read them.
 *
 * The minimum note is always shown, deposits or not: it is also the answer to
 * "I sent $1 and nothing arrived".
 */
export const MicroDepositsCard = ({ deposits }: { deposits: VirtualAccountMicroDeposit[] }) => {
  const hasVerification = deposits.some(deposit => deposit.isAccountVerification);

  return (
    <View className="gap-3 pt-4">
      {deposits.length > 0 && (
        <View className="gap-2">
          <Text className="px-1 text-[16px] font-semibold text-white">
            {hasVerification ? 'Verification deposits' : 'Deposits under $2'}
          </Text>
          <Text className="px-1 text-[14px] leading-5 text-white/70">
            {hasVerification
              ? 'Enter these amounts with the bank or app that sent them to confirm this account is yours.'
              : "These deposits were too small to process and weren't added to your balance."}
          </Text>
          <View className="overflow-hidden rounded-twice bg-card">
            {deposits.map((deposit, index) => (
              <MicroDepositRow
                key={deposit.id}
                deposit={deposit}
                withDivider={index < deposits.length - 1}
              />
            ))}
          </View>
        </View>
      )}

      <View className="rounded-twice bg-card" style={styles.note}>
        <Text className="text-[14px] leading-5 text-white/70">
          {`Bank deposits under $${VIRTUAL_ACCOUNT_MINIMUM_DEPOSIT_USD} aren't added to your balance. If your bank sends small verification deposits, they'll appear here so you can confirm them.`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Matches the details card's rows so the two cards read as one sheet.
  row: { paddingLeft: 21, paddingRight: 14, paddingVertical: 18 },
  divider: { backgroundColor: 'rgba(255, 255, 255, 0.1)', height: 1 },
  note: { paddingHorizontal: 21, paddingVertical: 16 },
});
