import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import * as Sentry from '@sentry/react-native';

import Trash from '@/assets/images/trash';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRANSACTION_DETAILS } from '@/constants/transaction';
import { useDimension } from '@/hooks/useDimension';
import { useDirectDepositSession } from '@/hooks/useDirectDepositSession';
import { getAsset } from '@/lib/assets';
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
  amount: string;
  status: TransactionStatus;
  hash?: string;
  type: TransactionType;
  classNames?: TransactionClassNames;
  symbol?: string;
  logoUrl?: string;
  onPress?: () => void;
  clientTxId?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
  showTimestamp?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

const Transaction = ({
  title,
  amount,
  status,
  classNames,
  symbol,
  logoUrl,
  onPress,
  type,
  clientTxId,
  metadata,
  timestamp,
  showTimestamp = true,
  isFirst = false,
  isLast = false,
}: TransactionProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteDirectDepositSession } = useDirectDepositSession();
  const { isScreenMedium } = useDimension();

  const isPending = status === TransactionStatus.PENDING;
  const isFailed = status === TransactionStatus.FAILED;
  const isCancelled = status === TransactionStatus.CANCELLED;
  const isProcessing = status === TransactionStatus.PROCESSING;
  const isExpired = status === TransactionStatus.EXPIRED;
  const isRefunded = status === TransactionStatus.REFUNDED;
  const transactionDetails = TRANSACTION_DETAILS[type];

  // Only show badge for failed status

  const statusBadge = isFailed
    ? {
        text: 'Failed',
        bgColor: 'bg-red-500/20',
        textColor: 'text-red-400',
      }
    : isExpired
      ? {
          text: 'Expired',
          bgColor: 'bg-orange-500/20',
          textColor: 'text-orange-400',
        }
      : isRefunded
        ? {
            text: 'Refunded',
            bgColor: 'bg-purple-500/20',
            textColor: 'text-purple-400',
          }
        : null;

  // Check if this is a direct deposit with no amount yet
  const isDirectDeposit = clientTxId?.startsWith('direct_deposit_');
  const hasNoAmount = !amount || amount === '0' || parseFloat(amount) === 0;

  // Determine status message for direct deposits with no amount
  const getDirectDepositStatusMessage = () => {
    if (!isDirectDeposit || !hasNoAmount) return null;
    if (isFailed) return 'Failed';
    if (isExpired) return 'Expired';
    if (isRefunded) return 'Refunded';
    if (isProcessing) return 'Processing deposit...';
    // For pending, check metadata for more specific status
    if (isPending) {
      const depositStatus = metadata?.directDepositStatus;
      if (depositStatus === 'detected') return 'Transfer detected';
    }
    return null;
  };

  const directDepositStatusMessage = getDirectDepositStatusMessage();

  // Determine if we should show progress indicator (for pending/processing direct deposits)
  const isPendingOrProcessing = isPending || isProcessing;
  const directDepositIsPendingOrProcessing = isDirectDeposit && isPendingOrProcessing;

  const handleDeleteConfirm = async () => {
    if (!isDirectDeposit || !clientTxId) return;

    try {
      setIsDeleting(true);
      await deleteDirectDepositSession(clientTxId);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Failed to delete direct deposit session:', error);
      Sentry.captureException(error, {
        tags: {
          type: 'delete_direct_deposit_error',
          clientTxId,
        },
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeletePress = (e: any) => {
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

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
    : isExpired
      ? 'text-orange-400'
      : isRefunded
        ? 'text-purple-400'
        : isCancelled
          ? ''
          : isIncoming
            ? 'text-brand'
            : '';

  const statusSign = isFailed
    ? TransactionDirection.FAILED
    : isExpired || isRefunded
      ? TransactionDirection.CANCELLED
      : isCancelled
        ? TransactionDirection.CANCELLED
        : (transactionDetails?.sign ?? '');

  const tokenIcon = getTokenIcon({
    logoUrl,
    tokenSymbol: symbol?.toLowerCase() === 'usdc.e' ? 'USDC' : symbol,
    size: 44,
  });

  const getDescription = () => {
    if (isDeposit && isPending) {
      return 'Deposit in progress';
    }
    return transactionDetails?.category ?? 'Unknown';
  };

  const formatTimestamp = () => {
    if (!timestamp) return null;
    try {
      const date = new Date(Number(timestamp) * 1000);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
        .format(date)
        .replace(',', ' at');
    } catch {
      return null;
    }
  };

  const formattedTimestamp = formatTimestamp();

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-between bg-[#1C1C1E] px-4 py-4',
        !isLast && 'border-b border-[#2C2C2E]',
        isFirst && 'rounded-t-[20px]',
        isLast && 'rounded-b-[20px]',
        classNames?.container,
      )}
    >
      <View className="min-w-0 flex-[1.5] flex-row items-center gap-2 md:gap-4">
        <RenderTokenIcon tokenIcon={tokenIcon} size={44} />
        <View className="min-w-0 flex-shrink">
          <Text className="text-base font-medium web:text-lg" numberOfLines={1}>
            {title}
          </Text>
          <View className="flex-row items-center gap-1">
            {isReward && (
              <Image
                source={getAsset('images/green-diamond.png')}
                style={{ width: 12, height: 12 }}
                contentFit="contain"
                alt="Reward indicator"
              />
            )}
            {isPending && <ActivityIndicator color="gray" size={14} />}
            <Text className="text-sm font-medium text-muted-foreground">{getDescription()}</Text>
          </View>
        </View>
        {(isFailed || isExpired || isRefunded) && statusBadge && (
          <View className={cn(statusBadge.bgColor, 'flex-shrink-0 rounded-full px-2 py-1')}>
            <Text className={cn(statusBadge.textColor, 'text-xs font-bold')}>
              {statusBadge.text}
            </Text>
          </View>
        )}
      </View>

      {formattedTimestamp && isScreenMedium && showTimestamp && (
        <View className="flex-[1.5] flex-row items-center justify-center px-2">
          <Text className="text-center text-sm font-medium text-muted-foreground">
            {formattedTimestamp}
          </Text>
        </View>
      )}

      <View className="min-w-0 flex-[1] items-end">
        {directDepositStatusMessage || amount === '0' ? (
          <Text
            className={cn(
              'text-sm font-medium',
              isFailed
                ? 'text-red-400'
                : isExpired
                  ? 'text-orange-400'
                  : isRefunded
                    ? 'text-purple-400'
                    : 'text-muted-foreground',
            )}
          >
            {directDepositStatusMessage}
          </Text>
        ) : (
          <Text className={cn('text-base font-medium web:text-lg', statusTextColor)}>
            {statusSign}
            {formatNumber(Number(amount), 2)} {symbol?.toLowerCase() === 'sousd' ? 'soUSD' : symbol}
          </Text>
        )}
        {directDepositIsPendingOrProcessing && (
          <Pressable
            onPress={handleDeletePress}
            className="items-center justify-center h-10 w-10 rounded-full bg-popover p-0 web:transition-colors web:hover:bg-muted"
          >
            <Trash />
          </Pressable>
        )}
      </View>

      <ResponsiveDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete direct deposit?"
        contentClassName="px-6 py-6"
      >
        <View className="flex flex-col gap-6">
          <Text className="text-base text-muted-foreground">
            Are you sure you want to delete this direct deposit session? This action cannot be
            undone.
          </Text>
          <View className="flex flex-row gap-3">
            <Button
              onPress={() => setIsDeleteDialogOpen(false)}
              className="h-12 flex-1 rounded-2xl bg-white/10 web:hover:bg-white/15"
              disabled={isDeleting}
            >
              <Text className="text-base font-semibold text-white">Cancel</Text>
            </Button>
            <Button
              onPress={handleDeleteConfirm}
              className="h-12 flex-1 rounded-2xl bg-red-500 web:hover:bg-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-base font-semibold text-white">Delete</Text>
              )}
            </Button>
          </View>
        </View>
      </ResponsiveDialog>
    </Pressable>
  );
};

export default Transaction;
