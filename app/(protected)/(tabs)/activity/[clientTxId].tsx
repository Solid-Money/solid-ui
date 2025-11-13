import Diamond from '@/assets/images/diamond';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { format, minutesToSeconds } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpRight, ChevronLeft, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { mainnet } from 'viem/chains';

import CopyToClipboard from '@/components/CopyToClipboard';
import EstimatedTime from '@/components/EstimatedTime';
import PageLayout from '@/components/PageLayout';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRANSACTION_DETAILS } from '@/constants/transaction';
import { useActivity } from '@/hooks/useActivity';
import useCancelOnchainWithdraw from '@/hooks/useCancelOnchainWithdraw';
import { fetchActivityEvent, getCardTransaction } from '@/lib/api';
import getTokenIcon from '@/lib/getTokenIcon';
import {
  CardTransaction,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import { cn, eclipseAddress, formatNumber, toTitleCase, withRefreshToken } from '@/lib/utils';
import {
  formatCardAmount,
  getAvatarColor,
  getCashbackAmount,
  getInitials,
} from '@/lib/utils/cardHelpers';

type RowProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
};

type LabelProps = {
  children: React.ReactNode;
};

type ValueProps = {
  children: React.ReactNode;
  className?: string;
};

type BackProps = {
  title: string;
  className?: string;
};

const Row = ({ label, value, className }: RowProps) => {
  return (
    <View className={cn('flex-row justify-between p-5 border-b border-[#2C2C2E]', className)}>
      {label}
      {value}
    </View>
  );
};

const Label = ({ children }: LabelProps) => {
  return <Text className="text-[#8E8E93] font-medium">{children}</Text>;
};

const Value = ({ children, className }: ValueProps) => {
  return <Text className={cn('text-lg font-bold', className)}>{children}</Text>;
};

const Back = ({ title, className }: BackProps) => {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();

  const handleBackPress = () => {
    const tabParam = params.tab ? `?tab=${params.tab}` : '';
    router.replace(`${path.ACTIVITY}${tabParam}` as any);
  };

  return (
    <View className="flex-row items-center justify-between">
      <Pressable onPress={handleBackPress} className="web:hover:opacity-70">
        <ChevronLeft color="white" />
      </Pressable>
      <Text className={cn('text-white text-lg font-semibold text-center', className)}>{title}</Text>
      <View className="w-10" />
    </View>
  );
};

type CardTransactionDetailProps = {
  transaction: CardTransaction;
};

const CardTransactionDetail = ({ transaction }: CardTransactionDetailProps) => {
  const merchantName = transaction.merchant_name || transaction.description || 'Unknown';
  const initials = getInitials(merchantName);
  const avatarColor = getAvatarColor(merchantName);

  const rows = [
    {
      label: <Label>Sent from</Label>,
      value: <Value>Card</Value>,
      enabled: true,
    },
    {
      label: <Label>Status</Label>,
      value: <Value>Confirmed</Value>,
      enabled: true,
    },
    {
      label: (
        <View className="flex-row items-center gap-1.5">
          <Diamond />
          <Label>Cashback</Label>
        </View>
      ),
      value: <Value className="text-[#34C759]">{getCashbackAmount()}</Value>,
      enabled: true,
    },
    {
      label: <Label>Explorer</Label>,
      value: transaction.crypto_transaction_details?.tx_hash && (
        <Pressable
          onPress={() =>
            Linking.openURL(
              `https://arbiscan.io/tx/${transaction.crypto_transaction_details?.tx_hash}`,
            )
          }
          className="hover:opacity-70"
        >
          <View className="flex-row items-center gap-1">
            <Value className="underline">
              {eclipseAddress(transaction.crypto_transaction_details.tx_hash)}
            </Value>
            <ArrowUpRight color="white" size={16} />
          </View>
        </Pressable>
      ),
      enabled: !!transaction.crypto_transaction_details?.tx_hash,
    },
  ];

  const isLastRow = (index: number) => {
    const lastEnabledIndex = rows.findLastIndex(row => row.enabled);
    return index === lastEnabledIndex;
  };

  return (
    <PageLayout desktopOnly>
      <View className="flex-1 gap-10 px-4 py-8 md:py-12 w-full max-w-lg mx-auto">
        <Back title={merchantName} className="text-xl md:text-3xl" />

        <View className="items-center gap-4">
          {/* Avatar with initials */}
          <View
            className={cn(
              'w-[120px] h-[120px] rounded-full items-center justify-center',
              avatarColor,
            )}
          >
            <Text className="text-white text-5xl font-semibold">{initials}</Text>
          </View>

          <View className="items-center">
            <Text className="text-4xl font-bold text-white">
              {formatCardAmount(transaction.amount)}
            </Text>
            <Text className="text-muted-foreground font-semibold mt-2">
              {format(new Date(transaction.posted_at), "do MMM yyyy 'at' h:mm a")}
            </Text>
          </View>
        </View>

        <View className="bg-[#1C1C1E] rounded-[20px]">
          {rows.map(
            (row, index) =>
              row.enabled && (
                <Row
                  key={index}
                  label={row.label}
                  value={row.value}
                  className={cn(isLastRow(index) && 'border-b-0')}
                />
              ),
          )}
        </View>
      </View>
    </PageLayout>
  );
};

export default function ActivityDetail() {
  const { clientTxId } = useLocalSearchParams<{ clientTxId: string }>();
  const { cancelOnchainWithdraw } = useCancelOnchainWithdraw();
  const [currentTime, setCurrentTime] = useState(minutesToSeconds(5));
  const { cachedActivities, isLoading: isActivitiesLoading } = useActivity();
  // Search by clientTxId, hash, or userOpHash (in case URL uses hash instead of clientTxId)
  const activity = cachedActivities.find(
    activity =>
      activity.clientTxId === clientTxId ||
      activity.hash === clientTxId ||
      activity.userOpHash === clientTxId,
  );

  // Check if this is a card transaction
  const isCardTransaction = clientTxId?.startsWith('card-');
  const cardTxId = isCardTransaction ? clientTxId.replace('card-', '') : null;

  // Fetch card transaction from API
  const { data: cardTransaction, isLoading: isCardTransactionLoading } = useQuery({
    queryKey: ['card-transaction', cardTxId],
    queryFn: () => withRefreshToken(() => getCardTransaction(cardTxId!)),
    enabled: !!cardTxId && isCardTransaction,
  });

  // Fetch from backend if not found in cache (fallback for activities not yet loaded)
  const { data: backendActivity, isLoading: isBackendLoading } = useQuery({
    queryKey: ['activity-event', clientTxId],
    queryFn: () => withRefreshToken(() => fetchActivityEvent(clientTxId)),
    enabled: !activity && !isActivitiesLoading && !!clientTxId && !clientTxId.startsWith('card-'),
  });

  const finalActivity = activity || backendActivity;
  const isAnyLoading = isActivitiesLoading || isBackendLoading || isCardTransactionLoading;

  const isDeposit = finalActivity?.type === TransactionType.DEPOSIT;
  const isEthereum = finalActivity?.chainId === mainnet.id;
  const createdAt = useMemo(
    () => (finalActivity?.timestamp ? new Date(Number(finalActivity.timestamp) * 1000) : null),
    [finalActivity],
  );

  useEffect(() => {
    if (!finalActivity || !isDeposit || !createdAt) return;

    const estimatedDuration = isEthereum ? minutesToSeconds(5) : minutesToSeconds(20);
    const createdAtTime = createdAt.getTime();
    const elapsedSeconds = Math.floor((Date.now() - createdAtTime) / 1000);
    const remainingTime = Math.max(0, estimatedDuration - elapsedSeconds);
    setCurrentTime(remainingTime);
  }, [finalActivity, isDeposit, isEthereum, createdAt]);

  // Show card transaction detail if it's a card transaction
  if (isCardTransaction && cardTransaction && !isAnyLoading) {
    return <CardTransactionDetail transaction={cardTransaction} />;
  }

  if (!finalActivity && !isCardTransaction && !isAnyLoading) {
    return (
      <PageLayout desktopOnly>
        <View className="gap-8 md:gap-16 px-4 py-8 md:py-12 w-full max-w-lg mx-auto">
          <Back title={`Transaction ${eclipseAddress(clientTxId)} not found`} />
        </View>
      </PageLayout>
    );
  }

  if (!finalActivity && !isAnyLoading) return null;

  if (!finalActivity) return null;

  const isFailed = finalActivity.status === TransactionStatus.FAILED;
  const isCancelled = finalActivity.status === TransactionStatus.CANCELLED;
  const isPending = finalActivity.status === TransactionStatus.PENDING;
  const transactionDetails = TRANSACTION_DETAILS[finalActivity.type];

  if (!transactionDetails) {
    console.error('[ActivityDetail] Unknown transaction type:', finalActivity.type, {
      clientTxId,
      title: finalActivity.title,
      amount: finalActivity.amount,
      status: finalActivity.status,
      symbol: finalActivity.symbol,
    });

    Sentry.captureException(new Error(`Unknown transaction type: ${finalActivity.type}`), {
      tags: {
        type: 'unknown_transaction_type',
        transaction_type: finalActivity.type,
        screen: 'activity_detail',
      },
      extra: {
        clientTxId,
        title: finalActivity.title,
        amount: finalActivity.amount,
        status: finalActivity.status,
        symbol: finalActivity.symbol,
      },
    });
  }

  const isIncoming = transactionDetails?.sign === TransactionDirection.IN;
  const isCancelWithdraw = finalActivity.requestId && isPending;

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
    tokenSymbol: finalActivity.symbol,
    size: 75,
  });

  const handleCancelWithdraw = async () => {
    if (!isCancelWithdraw) return;
    await cancelOnchainWithdraw(finalActivity.requestId!);
  };

  const rows = [
    {
      label: <Label>Sent from</Label>,
      value: finalActivity.fromAddress && (
        <View className="flex-row items-center gap-1">
          <Value>{eclipseAddress(finalActivity.fromAddress)}</Value>
          <CopyToClipboard text={finalActivity.fromAddress} />
        </View>
      ),
      enabled: !!finalActivity.fromAddress,
    },
    {
      label: <Label>Recipient</Label>,
      value: finalActivity.toAddress && (
        <View className="flex-row items-center gap-1">
          <Value>{eclipseAddress(finalActivity.toAddress)}</Value>
          <CopyToClipboard text={finalActivity.toAddress} />
        </View>
      ),
      enabled: !!finalActivity.toAddress,
    },
    {
      label: <Label>Status</Label>,
      value: <Value>{toTitleCase(finalActivity.status)}</Value>,
      enabled: !!finalActivity.status,
    },
    {
      label: <Label>Paid</Label>,
      value: finalActivity.metadata?.inputAmount && finalActivity.metadata?.inputToken && (
        <Value>
          {finalActivity.metadata.inputAmount} {finalActivity.metadata.inputToken}
        </Value>
      ),
      enabled: !!finalActivity.metadata?.inputAmount && !!finalActivity.metadata?.inputToken,
    },
    {
      label: <Label>Received</Label>,
      value: finalActivity.metadata?.outputAmount && finalActivity.metadata?.outputToken && (
        <Value>
          {finalActivity.metadata.outputAmount} {finalActivity.metadata.outputToken}
        </Value>
      ),
      enabled: !!finalActivity.metadata?.outputAmount && !!finalActivity.metadata?.outputToken,
    },
    {
      label: <Label>Explorer</Label>,
      value: finalActivity.url && finalActivity.hash && (
        <Pressable onPress={() => Linking.openURL(finalActivity.url!)} className="hover:opacity-70">
          <View className="flex-row items-center gap-1">
            <Value className="underline">{eclipseAddress(finalActivity.hash)}</Value>
            <ArrowUpRight color="white" size={16} />
          </View>
        </Pressable>
      ),
      enabled: !!finalActivity.url && !!finalActivity.hash,
    },
    {
      label: <Label>Estimated time</Label>,
      value: <EstimatedTime currentTime={currentTime} setCurrentTime={setCurrentTime} />,
      enabled: isDeposit && isPending,
    },
  ];

  const isLastRow = (index: number) => {
    const lastEnabledIndex = rows.findLastIndex(row => row.enabled);
    return index === lastEnabledIndex;
  };

  return (
    <PageLayout desktopOnly isLoading={isAnyLoading}>
      <View className="flex-1 gap-10 px-4 py-8 md:py-12 w-full max-w-lg mx-auto">
        <Back title={finalActivity.title} className="text-xl md:text-3xl" />

        <View className="items-center gap-4">
          <RenderTokenIcon tokenIcon={tokenIcon} size={75} />

          <View className="items-center">
            <Text className={cn('text-2xl font-bold', statusTextColor)}>
              {statusSign}
              {formatNumber(Number(finalActivity.amount))}{' '}
              {finalActivity.symbol?.toLowerCase() === 'sousd' ? 'soUSD' : finalActivity.symbol}
            </Text>
            <Text className="text-muted-foreground font-semibold">
              {format(Number(finalActivity.timestamp) * 1000, "do MMM yyyy 'at' h:mm a")}
            </Text>
          </View>
        </View>

        <View className="bg-card rounded-twice">
          {rows.map(
            (row, index) =>
              row.enabled && (
                <Row
                  key={index}
                  label={row.label}
                  value={row.value}
                  className={cn(isLastRow(index) && 'border-b-0')}
                />
              ),
          )}
        </View>

        {isCancelWithdraw && (
          <Button
            onPress={handleCancelWithdraw}
            variant="secondary"
            className="rounded-xl h-14 border-0"
          >
            <X color="white" size={16} />
            <Text>Cancel Withdraw</Text>
          </Button>
        )}
      </View>
    </PageLayout>
  );
}
