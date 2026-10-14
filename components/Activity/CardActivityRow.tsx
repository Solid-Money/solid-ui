import React from 'react';
import { Pressable, View } from 'react-native';

import CardActivityIcon from '@/components/Activity/CardActivityIcon';
import { CashbackDiamondIcon } from '@/components/Card/NewCardDetails/icons';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { CardProvider, CardTransaction, Cashback } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatActivityTimestamp } from '@/lib/utils/activity';
import {
  formatCardTransactionAmount,
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

/** Secondary labels for unsettled card transactions. */
const STATUS_LABELS: Record<string, { label: string; tone: 'neutral' | 'danger' }> = {
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
  const statusLabel = STATUS_LABELS[transaction.status?.toLowerCase() ?? ''];
  const cashbackInfo = getCashbackAmount(transaction.id, cashbacks);

  // A purchase takes money, so it reads with a minus — the stored sign is the
  // ledger's and says the opposite. See `isOutgoingCardTransaction`.
  const isOutgoing = isOutgoingCardTransaction(transaction);

  const formattedTimestamp = formatActivityTimestamp(getCardTransactionTimestamp(transaction));

  const cashbackLabel =
    cashbackInfo?.isPending && !cashbackInfo.isEscrowed ? 'Cashback (Pending)' : 'Cashback';

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
              {/* Green, glyph and label both, like the figure they name on the
                  right: what the purchase earned back reads as a gain rather
                  than as another fact about the charge. The receipt's own
                  diamond, so a tapped row and the screen it opens agree. */}
              <CashbackDiamondIcon size={13} />
              <Text className="text-sm font-medium text-brand">{cashbackLabel}</Text>
            </View>
          )}
          {statusLabel && (
            <Text
              className={cn(
                'text-sm font-medium',
                statusLabel.tone === 'danger' ? 'text-[#F27F81]' : 'text-white/70',
              )}
            >
              {statusLabel.label}
            </Text>
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
        {/* Green whether or not the payout has landed: it is money coming back
            either way. The receipt shows when escrowed cashback releases. */}
        {cashbackInfo?.amount && (
          <Text className="text-sm font-medium text-brand">{cashbackInfo.amount}</Text>
        )}
      </View>
    </Pressable>
  );
};

export default React.memo(CardActivityRow);
