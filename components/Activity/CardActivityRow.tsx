import React from 'react';
import { Pressable, View } from 'react-native';

import Diamond from '@/assets/images/diamond';
import ActivityStatusPill from '@/components/Activity/ActivityStatusPill';
import CardActivityIcon from '@/components/Activity/CardActivityIcon';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { CardProvider, CardTransaction, Cashback } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatActivityTimestamp } from '@/lib/utils/activity';
import {
  formatCardTransactionAmount,
  getCardFeeInfo,
  getCardMerchantLocation,
  getCardMerchantName,
  getCashbackAmount,
  isOutgoingCardTransaction,
} from '@/lib/utils/cardHelpers';
import { getCardTransactionTimestamp } from '@/lib/utils/unifiedActivity';

type CardActivityRowProps = {
  transaction: CardTransaction;
  cashbacks?: Cashback[];
  provider?: CardProvider | null;
  onPress?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  /** Desktop's middle date column — matches `Transaction` so merged rows align. */
  showTimestamp?: boolean;
};

/** Card statuses that get a chip of their own instead of a location line. */
const STATUS_PILLS: Record<string, { label: string; tone: 'neutral' | 'danger' }> = {
  pending: { label: 'Pending', tone: 'neutral' },
  declined: { label: 'Declined', tone: 'danger' },
  reversed: { label: 'Reversed', tone: 'neutral' },
};

/**
 * A card transaction as it appears in the activity feed (Figma 24781:7700).
 *
 * Deliberately mirrors `components/Transaction`'s frame — the same padding,
 * divider and corner rules — because the two sit in one list and any difference
 * between them reads as a mistake rather than a distinction.
 */
const CardActivityRow = ({
  transaction,
  cashbacks,
  provider,
  onPress,
  isFirst = false,
  isLast = false,
  showTimestamp = false,
}: CardActivityRowProps) => {
  const { isScreenMedium } = useDimension();
  const merchantName = getCardMerchantName(transaction);
  const merchantLocation = getCardMerchantLocation(transaction);
  const statusPill = STATUS_PILLS[transaction.status?.toLowerCase() ?? ''];
  const cashbackInfo = getCashbackAmount(transaction.id, cashbacks);
  const feeInfo = getCardFeeInfo(transaction);

  // A purchase takes money, so it reads with a minus — the stored sign is the
  // ledger's and says the opposite. See `isOutgoingCardTransaction`.
  const isOutgoing = isOutgoingCardTransaction(transaction);

  // Dollar equivalent of a foreign charge, so a row reads without mental
  // arithmetic. Nothing to add when the card was charged in dollars. Signed to
  // follow the charge rather than itself: it is stored unsigned.
  const currencyCode = transaction.currency?.trim().toUpperCase();
  const usdEquivalent =
    transaction.usd_amount && currencyCode && currencyCode !== 'USD'
      ? formatCardTransactionAmount(transaction.usd_amount, isOutgoing, provider)
      : undefined;

  const formattedTimestamp = formatActivityTimestamp(getCardTransactionTimestamp(transaction));

  const cashbackLabel = cashbackInfo?.isEscrowed
    ? 'Cashback (Escrowed)'
    : cashbackInfo?.isPending
      ? 'Cashback (Pending)'
      : 'Cashback';

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-between bg-[#1C1C1E] px-4 py-4',
        !isLast && 'border-b border-[#2C2C2E]',
        isFirst && 'rounded-t-[20px]',
        isLast && 'rounded-b-[20px]',
      )}
    >
      <View className="min-w-0 flex-[1.5] flex-row items-center gap-2 md:gap-4">
        <CardActivityIcon transaction={transaction} size={44} />
        <View className="min-w-0 flex-shrink gap-0.5">
          <Text className="text-base font-medium web:text-lg" numberOfLines={1}>
            {merchantName}
          </Text>
          {/* An ineligible purchase earns nothing, and a diamond on the row
              would advertise the opposite. The receipt says why. */}
          {cashbackInfo && !cashbackInfo.isIneligible && (
            <View className="flex-row items-center gap-1">
              <Diamond width={12} height={12} />
              <Text className="text-sm font-medium text-muted-foreground">{cashbackLabel}</Text>
            </View>
          )}
          {feeInfo && (
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {feeInfo.isWaived
                ? `${feeInfo.label} · ${feeInfo.waivedNote}`
                : feeInfo.isPending
                  ? `${feeInfo.label} (Pending)`
                  : `${feeInfo.label} · ${feeInfo.rate}`}
            </Text>
          )}
          {/* The chip stands in for the location line rather than joining it —
              where a purchase happened matters once it has actually gone
              through. */}
          {statusPill ? (
            <ActivityStatusPill label={statusPill.label} tone={statusPill.tone} />
          ) : (
            merchantLocation && (
              <Text className="text-sm text-white/70" numberOfLines={1}>
                {merchantLocation}
              </Text>
            )
          )}
        </View>
      </View>

      {formattedTimestamp && isScreenMedium && showTimestamp && (
        <View className="flex-[1.5] flex-row items-center justify-center px-2">
          <Text className="text-center text-sm font-medium text-muted-foreground">
            {formattedTimestamp}
          </Text>
        </View>
      )}

      <View className="min-w-0 flex-[1] items-end gap-0.5">
        <Text className="text-base font-medium web:text-lg">
          {formatCardTransactionAmount(
            transaction.amount,
            isOutgoing,
            provider,
            transaction.currency,
          )}
        </Text>
        {usdEquivalent && <Text className="text-sm text-white/70">{usdEquivalent}</Text>}
        {/* Green once the payout has landed; ordinary text while it is still a
            projection of what this purchase will earn. The label on the left
            already carries the escrow status, so the figure does not repeat
            it. */}
        {cashbackInfo?.amount && (
          <Text className={cn('text-sm font-medium', cashbackInfo.isPaid && 'text-brand')}>
            {cashbackInfo.amount}
          </Text>
        )}
        {feeInfo && (
          <Text
            className={cn(
              'text-sm font-medium',
              feeInfo.isWaived ? 'text-brand' : 'text-muted-foreground',
            )}
          >
            {feeInfo.amount}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

export default React.memo(CardActivityRow);
