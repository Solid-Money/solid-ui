import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRANSACTION_DETAILS } from '@/constants/transaction';
import { useActivity } from '@/hooks/useActivity';
import { useDirectDepositSession } from '@/hooks/useDirectDepositSession';
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
  metadata?: Record<string, any>;
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
  metadata,
}: TransactionProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteDirectDepositSession } = useDirectDepositSession();
  const { refetchAll } = useActivity();

  const isPending = status === TransactionStatus.PENDING;
  const isFailed = status === TransactionStatus.FAILED;
  const isCancelled = status === TransactionStatus.CANCELLED;
  const transactionDetails = TRANSACTION_DETAILS[type];

  // Check if this is a direct deposit with no amount yet
  const isDirectDeposit = clientTxId?.startsWith('direct_deposit_');
  const hasNoAmount = !amount || amount === '0' || parseFloat(amount) === 0;
  const isProcessing = status === TransactionStatus.PROCESSING;

  // Determine status message for direct deposits with no amount
  const getDirectDepositStatusMessage = () => {
    if (!isDirectDeposit || !hasNoAmount) return null;
    if (isFailed) return 'Failed';
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

  // Extract session ID from clientTxId (format: direct_deposit_{sessionId})
  const sessionId =
    isDirectDeposit && clientTxId ? clientTxId.replace('direct_deposit_', '') : null;

  const handleDeleteConfirm = async () => {
    if (!sessionId) return;

    try {
      setIsDeleting(true);
      await deleteDirectDepositSession(sessionId);
      setIsDeleteDialogOpen(false);

      // Refresh the activity list
      refetchAll();
    } catch (error) {
      console.error('Failed to delete direct deposit session:', error);
      Sentry.captureException(error, {
        tags: {
          type: 'delete_direct_deposit_error',
          sessionId,
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
    tokenSymbol: symbol?.toLowerCase() === 'usdc.e' ? 'USDC' : symbol,
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
        {directDepositStatusMessage || amount === '0' ? (
          <Text
            className={cn(
              'text-sm font-medium text-right',
              isFailed ? 'text-red-400' : 'text-muted-foreground',
            )}
          >
            {directDepositStatusMessage}
          </Text>
        ) : (
          <Text className={cn('text-lg font-medium text-right', statusTextColor)}>
            {statusSign}
            {formatNumber(Number(amount))} {symbol?.toLowerCase() === 'sousd' ? 'soUSD' : symbol}
          </Text>
        )}
        {directDepositIsPendingOrProcessing && (
          <Pressable onPress={handleDeletePress} className="p-1 hover:opacity-70">
            <Trash2 size={18} color="#A1A1AA" />
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
              className="flex-1 h-12 rounded-2xl bg-white/10 web:hover:bg-white/15"
              disabled={isDeleting}
            >
              <Text className="text-base font-semibold text-white">Cancel</Text>
            </Button>
            <Button
              onPress={handleDeleteConfirm}
              className="flex-1 h-12 rounded-2xl bg-red-500 web:hover:bg-red-600"
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
