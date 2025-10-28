import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, View } from 'react-native';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import { TRANSACTION_DETAILS } from '@/constants/transaction';
import getTokenIcon from '@/lib/getTokenIcon';
import {
  TransactionCategory,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';

type TransactionClassNames = {
  container?: string;
};

interface TransactionProps {
  title: string;
  shortTitle?: string;
  amount: string;
  status: TransactionStatus;
  hash?: string;
  type: TransactionType;
  classNames?: TransactionClassNames;
  symbol?: string;
  logoUrl?: string;
  onPress?: () => void;
  clientTxId?: string;
}

const Transaction = ({
  title,
  shortTitle,
  amount,
  status,
  classNames,
  symbol,
  logoUrl,
  onPress,
  type,
  clientTxId,
}: TransactionProps) => {
  const isPending = status === TransactionStatus.PENDING;
  const isFailed = status === TransactionStatus.FAILED;
  const isCancelled = status === TransactionStatus.CANCELLED;
  const transactionDetails = TRANSACTION_DETAILS[type];

  // Check if this is a direct deposit with no amount yet
  const isDirectDeposit = clientTxId?.startsWith('direct_deposit_');
  const isPending = status === TransactionStatus.PENDING;
  const hasNoAmount = !amount || amount === '0' || parseFloat(amount) === 0;
  const shouldShowWaitingMessage = isDirectDeposit && isPending && hasNoAmount;
  const shouldShowFailedMessage = isDirectDeposit && isFailed && hasNoAmount;

  if (!transactionDetails) {
    console.error('[Transaction] Unknown transaction type:', type, {
      title,
      amount,
      status,
      symbol,
    });

    Sentry.captureException(new Error(`Unknown transaction type: ${type}`), {
      tags: {
        type: 'unknown_transaction_type',
        transaction_type: type,
      },
      extra: {
        title,
        amount,
        status,
        symbol,
      },
    });
  }

  const isIncoming = transactionDetails?.sign === TransactionDirection.IN;
  const isReward = transactionDetails?.category === TransactionCategory.REWARD;
  const isDeposit = type === TransactionType.DEPOSIT;

  const statusTextColor = isFailed
    ? 'text-red-400'
    : isCancelled
      ? ''
      : isIncoming
        ? 'text-brand'
        : '';

  const statusSign = isFailed
    ? TransactionDirection.FAILED
    : isCancelled
      ? TransactionDirection.CANCELLED
      : (transactionDetails?.sign ?? '');

  const tokenIcon = getTokenIcon({
    logoUrl,
    tokenSymbol: symbol,
    size: 34,
  });

  const getDescription = () => {
    if (isDeposit && isPending) {
      return 'Deposit in progress';
    }
    return transactionDetails?.category ?? 'Unknown';
  };

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-between p-4 md:px-6 hover:opacity-80',
        'border-b border-border/40',
        classNames?.container,
      )}
    >
      <View className="flex-row items-center gap-2 md:gap-4 flex-1 mr-2">
        <RenderTokenIcon tokenIcon={tokenIcon} size={34} />
        <View className="flex-1">
          <Text className="hidden md:block text-lg font-medium" numberOfLines={1}>
            {title}
          </Text>
          <Text className="block md:hidden text-lg font-medium" numberOfLines={1}>
            {shortTitle || title}
          </Text>
          <View className="flex-row items-center gap-1">
            {isReward && (
              <Image
                source={require('@/assets/images/green-diamond.png')}
                style={{ width: 12, height: 12 }}
                contentFit="contain"
              />
            )}
            <View className="flex-row items-center gap-1">
              {isPending && <ActivityIndicator color="gray" size={14} />}
              <Text className="text-sm text-muted-foreground font-medium">{getDescription()}</Text>
            </View>
          </View>
        </View>
      </View>
      <View className="flex-row items-center gap-2 md:gap-4 flex-shrink-0">
        {shouldShowWaitingMessage ? (
          <Text className="text-sm text-muted-foreground font-medium text-right">
            Waiting for transfer
          </Text>
        ) : shouldShowFailedMessage ? (
          <Text className="text-sm text-red-400 font-medium text-right">Failed</Text>
        ) : (
          <Text className={cn('text-lg font-medium text-right', statusTextColor)}>
            {statusSign}
            {formatNumber(Number(amount))} {symbol?.toLowerCase() === 'sousd' ? 'soUSD' : symbol}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

export default Transaction;
