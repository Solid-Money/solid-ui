import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { format, minutesToSeconds } from 'date-fns';
import { ArrowUpRight, ChevronLeft, X } from 'lucide-react-native';
import { mainnet } from 'viem/chains';

import Diamond from '@/assets/images/diamond';
import SupportIcon from '@/assets/images/support-svg';
import CopyToClipboard from '@/components/CopyToClipboard';
import EstimatedTime from '@/components/EstimatedTime';
import PageLayout from '@/components/PageLayout';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { path } from '@/constants/path';
import { TRANSACTION_DETAILS } from '@/constants/transaction';
import { useActivity } from '@/hooks/useActivity';
import useCancelOnchainWithdraw from '@/hooks/useCancelOnchainWithdraw';
import { useCashbacks } from '@/hooks/useCashbacks';
import { fetchActivityEvent, getCardTransaction } from '@/lib/api';
import getTokenIcon from '@/lib/getTokenIcon';
import { useIntercom } from '@/lib/intercom';
import {
  CardTransaction,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import { cn, eclipseAddress, formatNumber, toTitleCase, withRefreshToken } from '@/lib/utils';
import {
  formatCardAmount,
  getCashbackAmount,
  getColorForTransaction,
  getInitials,
} from '@/lib/utils/cardHelpers';

type RowProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
  isLast?: boolean;
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

type SupportSectionProps = {
  transactionContext?: string;
};

const DATE_FORMAT = "do MMM yyyy 'at' h:mm a";

const Row = memo(function Row({ label, value, isLast }: RowProps) {
  return (
    <View
      className={cn(
        'flex-row justify-between border-b border-[#2C2C2E] p-5',
        isLast && 'border-b-0',
      )}
    >
      {label}
      {value}
    </View>
  );
});

const Label = memo(function Label({ children }: LabelProps) {
  return <Text className="text-base font-medium text-[#8E8E93]">{children}</Text>;
});

const Value = memo(function Value({ children, className }: ValueProps) {
  return <Text className={cn('text-lg font-bold', className)}>{children}</Text>;
});

const Back = memo(function Back({ title, className }: BackProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; from?: string }>();

  const handleBackPress = useCallback(() => {
    if (params.from === 'card') {
      router.replace(path.CARD_DETAILS);
      return;
    }
    const tabParam = params.tab ? `?tab=${params.tab}` : '';
    router.replace(`${path.ACTIVITY}${tabParam}` as any);
  }, [params.from, params.tab, router]);

  return (
    <View className="flex-row items-center justify-between">
      <Pressable onPress={handleBackPress} className="web:hover:opacity-70">
        <ChevronLeft color="white" />
      </Pressable>
      <Text className={cn('text-center text-lg font-semibold text-white', className)}>{title}</Text>
      <View className="w-10" />
    </View>
  );
});

const SupportSection = memo(function SupportSection({ transactionContext }: SupportSectionProps) {
  const intercom = useIntercom();

  const handleSupportPress = useCallback(() => {
    if (!intercom) return;
    if (transactionContext) {
      intercom.showNewMessage(transactionContext);
    } else {
      intercom.show();
    }
  }, [intercom, transactionContext]);

  return (
    <View className="mt-6 items-center">
      <Pressable
        onPress={handleSupportPress}
        className="flex-row items-center gap-2 active:opacity-70 web:hover:opacity-80"
      >
        <SupportIcon width={18} height={18} />
        <Text className="text-sm text-white/70">
          Got question?{' '}
          <Underline inline textClassName="text-sm text-white/70" borderColor="rgba(255, 255, 255, 0.7)">
            Click here
          </Underline>{' '}
          to talk with support
        </Text>
      </Pressable>
    </View>
  );
});

type CardTransactionDetailProps = {
  transaction: CardTransaction;
};

const CardTransactionDetail = memo(function CardTransactionDetail({
  transaction,
}: CardTransactionDetailProps) {
  const merchantName = transaction.merchant_name || transaction.description || 'Unknown';
  const isPurchase = transaction.category === 'purchase';
  const { data: cashbacks } = useCashbacks();

  const txHash = transaction.crypto_transaction_details?.tx_hash;
  const postedDate = useMemo(() => new Date(transaction.posted_at), [transaction.posted_at]);

  const initials = useMemo(() => getInitials(merchantName), [merchantName]);
  const color = useMemo(() => getColorForTransaction(merchantName), [merchantName]);

  const transactionContext = useMemo(
    () =>
      `Question about card transaction:\n\nMerchant: ${merchantName}\nAmount: ${formatCardAmount(transaction.amount)}\nDate: ${format(postedDate, DATE_FORMAT)}\nTransaction ID: card-${transaction.id}\n\nMy question: `,
    [merchantName, transaction.amount, transaction.id, postedDate],
  );

  const handleExplorerPress = useCallback(() => {
    if (txHash) Linking.openURL(`https://arbiscan.io/tx/${txHash}`);
  }, [txHash]);

  const rows = useMemo(() => {
    const allRows = [
      { key: 'from', label: <Label>Sent from</Label>, value: <Value>Card</Value> },
      { key: 'status', label: <Label>Status</Label>, value: <Value>Confirmed</Value> },
      {
        key: 'cashback',
        label: (
          <View className="flex-row items-center gap-1.5">
            <Diamond />
            <Label>Cashback</Label>
          </View>
        ),
        value: (
          <Value className="text-[#34C759]">{getCashbackAmount(transaction.id, cashbacks)}</Value>
        ),
      },
      txHash && {
        key: 'explorer',
        label: <Label>Explorer</Label>,
        value: (
          <Pressable onPress={handleExplorerPress} className="hover:opacity-70">
            <View className="flex-row items-center gap-1">
              <Underline textClassName="text-lg font-bold" borderColor="rgba(255, 255, 255, 1)">
                {eclipseAddress(txHash)}
              </Underline>
              <ArrowUpRight color="white" size={16} />
            </View>
          </Pressable>
        ),
      },
    ].filter(Boolean) as { key: string; label: React.ReactNode; value: React.ReactNode }[];

    return allRows;
  }, [transaction.id, cashbacks, txHash, handleExplorerPress]);

  const tokenIcon = useMemo(
    () => getTokenIcon({ tokenSymbol: transaction.currency?.toUpperCase(), size: 75 }),
    [transaction.currency],
  );

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg flex-1 gap-10 px-4 py-8 pb-32 md:py-12">
        <Back title={merchantName} className="text-xl md:text-3xl" />

        <View className="items-center gap-4">
          {/* Avatar with initials or token icon */}
          {isPurchase ? (
            <View
              className="h-[75px] w-[75px] items-center justify-center rounded-full"
              style={{ backgroundColor: color.bg }}
            >
              <Text className="text-5xl font-semibold" style={{ color: color.text }}>
                {initials}
              </Text>
            </View>
          ) : (
            <RenderTokenIcon tokenIcon={tokenIcon} size={75} />
          )}

          <View className="items-center">
            <Text className="text-4xl font-bold text-white">
              {formatCardAmount(transaction.amount)}
            </Text>
            <Text className="mt-2 font-semibold text-muted-foreground">Savings account</Text>
            <Text className="font-semibold text-muted-foreground">
              {format(postedDate, DATE_FORMAT)}
            </Text>
          </View>
        </View>

        <View className="rounded-[20px] bg-[#1C1C1E]">
          {rows.map((row, index) => (
            <Row
              key={row.key}
              label={row.label}
              value={row.value}
              isLast={index === rows.length - 1}
            />
          ))}
        </View>

        <SupportSection transactionContext={transactionContext} />
      </View>
    </PageLayout>
  );
});

const formatSymbol = (symbol?: string) => (symbol?.toLowerCase() === 'sousd' ? 'soUSD' : symbol);

export default function ActivityDetail() {
  const { clientTxId } = useLocalSearchParams<{ clientTxId: string }>();
  const { cancelOnchainWithdraw } = useCancelOnchainWithdraw();
  const [currentTime, setCurrentTime] = useState(minutesToSeconds(5));
  const { cachedActivities, isLoading: isActivitiesLoading } = useActivity();

  const activity = useMemo(
    () =>
      cachedActivities.find(
        a => a.clientTxId === clientTxId || a.hash === clientTxId || a.userOpHash === clientTxId,
      ),
    [cachedActivities, clientTxId],
  );

  // Check if this is a card transaction
  const isCardTransaction = clientTxId?.startsWith('card-');
  const cardTxId = isCardTransaction ? clientTxId.replace('card-', '') : null;

  // Fetch card transaction from API
  const { data: cardTransaction, isLoading: isCardTransactionLoading } = useQuery({
    queryKey: ['card-transaction', cardTxId],
    queryFn: () => withRefreshToken(() => getCardTransaction(cardTxId!)),
    enabled: !!cardTxId,
  });

  // Fetch from backend if not found in cache (fallback for activities not yet loaded)
  const { data: backendActivity, isLoading: isBackendLoading } = useQuery({
    queryKey: ['activity-event', clientTxId],
    queryFn: () => withRefreshToken(() => fetchActivityEvent(clientTxId)),
    enabled: !activity && !isActivitiesLoading && !!clientTxId && !isCardTransaction,
  });

  const finalActivity = activity || backendActivity;

  // Check if backend query should be loading but hasn't started yet
  const isBackendQueryPending =
    !activity && !isActivitiesLoading && !!clientTxId && !isCardTransaction && !backendActivity;
  const isAnyLoading =
    isActivitiesLoading || isBackendLoading || isCardTransactionLoading || isBackendQueryPending;

  const isDeposit = finalActivity?.type === TransactionType.DEPOSIT;
  const isEthereum = finalActivity?.chainId === mainnet.id;

  const createdAt = useMemo(
    () => (finalActivity?.timestamp ? new Date(Number(finalActivity.timestamp) * 1000) : null),
    [finalActivity?.timestamp],
  );

  useEffect(() => {
    if (!finalActivity || !isDeposit || !createdAt) return;

    const estimatedDuration = isEthereum ? minutesToSeconds(5) : minutesToSeconds(20);
    const elapsedSeconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);
    setCurrentTime(Math.max(0, estimatedDuration - elapsedSeconds));
  }, [finalActivity, isDeposit, isEthereum, createdAt]);

  const transactionDetails = finalActivity ? TRANSACTION_DETAILS[finalActivity.type] : null;

  // Report unknown transaction types
  useEffect(() => {
    if (!finalActivity || transactionDetails) return;

    const errorData = {
      clientTxId,
      title: finalActivity.title,
      amount: finalActivity.amount,
      status: finalActivity.status,
      symbol: finalActivity.symbol,
    };

    Sentry.captureException(new Error(`Unknown transaction type: ${finalActivity.type}`), {
      tags: {
        type: 'unknown_transaction_type',
        transaction_type: finalActivity.type,
        screen: 'activity_detail',
      },
      extra: errorData,
    });
  }, [finalActivity, transactionDetails, clientTxId]);

  const isFailed = finalActivity?.status === TransactionStatus.FAILED;
  const isCancelled = finalActivity?.status === TransactionStatus.CANCELLED;
  const isPending = finalActivity?.status === TransactionStatus.PENDING;
  const isIncoming = transactionDetails?.sign === TransactionDirection.IN;
  const isCancelWithdraw = finalActivity?.requestId && isPending;

  const statusTextColor = useMemo(() => {
    if (isFailed) return 'text-red-400';
    if (isCancelled) return '';
    if (isIncoming) return 'text-brand';
    return '';
  }, [isFailed, isCancelled, isIncoming]);

  const statusSign = useMemo(() => {
    if (isFailed) return TransactionDirection.FAILED;
    if (isCancelled) return TransactionDirection.CANCELLED;
    return transactionDetails?.sign ?? '';
  }, [isFailed, isCancelled, transactionDetails?.sign]);

  const description = useMemo(() => {
    if (isDeposit && isPending) return 'Deposit in progress';
    return transactionDetails?.category ?? 'Unknown';
  }, [isDeposit, isPending, transactionDetails?.category]);

  const tokenIcon = useMemo(
    () => (finalActivity ? getTokenIcon({ tokenSymbol: finalActivity.symbol, size: 75 }) : null),
    [finalActivity],
  );

  const handleCancelWithdraw = useCallback(async () => {
    if (!isCancelWithdraw || !finalActivity?.requestId) return;
    await cancelOnchainWithdraw(finalActivity.requestId);
  }, [isCancelWithdraw, finalActivity?.requestId, cancelOnchainWithdraw]);

  const handleExplorerPress = useCallback(() => {
    if (finalActivity?.url) Linking.openURL(finalActivity.url);
  }, [finalActivity?.url]);

  const rows = useMemo(() => {
    if (!finalActivity) return [];

    const { fromAddress, toAddress, status, metadata, url, hash } = finalActivity;

    return [
      fromAddress && {
        key: 'from',
        label: <Label>Sent from</Label>,
        value: (
          <View className="flex-row items-center gap-1">
            <Value>{eclipseAddress(fromAddress)}</Value>
            <CopyToClipboard text={fromAddress} />
          </View>
        ),
      },
      toAddress && {
        key: 'to',
        label: <Label>Recipient</Label>,
        value: (
          <View className="flex-row items-center gap-1">
            <Value>{eclipseAddress(toAddress)}</Value>
            <CopyToClipboard text={toAddress} />
          </View>
        ),
      },
      status && {
        key: 'status',
        label: <Label>Status</Label>,
        value: <Value>{toTitleCase(status)}</Value>,
      },
      metadata?.inputAmount &&
        metadata?.inputToken && {
          key: 'paid',
          label: <Label>Paid</Label>,
          value: (
            <Value>
              {metadata.inputAmount} {metadata.inputToken}
            </Value>
          ),
        },
      metadata?.outputAmount &&
        metadata?.outputToken && {
          key: 'received',
          label: <Label>Received</Label>,
          value: (
            <Value>
              {metadata.outputAmount} {metadata.outputToken}
            </Value>
          ),
        },
      url &&
        hash && {
          key: 'explorer',
          label: <Label>Explorer</Label>,
          value: (
          <Pressable onPress={handleExplorerPress} className="hover:opacity-70">
            <View className="flex-row items-center gap-1">
              <Underline textClassName="text-lg font-bold" borderColor="rgba(255, 255, 255, 1)">
                {eclipseAddress(hash)}
              </Underline>
              <ArrowUpRight color="white" size={16} />
            </View>
          </Pressable>
          ),
        },
      isDeposit &&
        isPending && {
          key: 'estimated',
          label: <Label>Estimated time</Label>,
          value: <EstimatedTime currentTime={currentTime} setCurrentTime={setCurrentTime} />,
        },
    ].filter(Boolean) as { key: string; label: React.ReactNode; value: React.ReactNode }[];
  }, [finalActivity, isDeposit, isPending, currentTime, handleExplorerPress]);

  const transactionContext = useMemo(() => {
    if (!finalActivity) return '';
    return `Question about transaction:\n\nTitle: ${finalActivity.title}\nAmount: ${statusSign}${formatNumber(Number(finalActivity.amount))} ${formatSymbol(finalActivity.symbol)}\nStatus: ${toTitleCase(finalActivity.status)}\nDate: ${format(Number(finalActivity.timestamp) * 1000, DATE_FORMAT)}\nTransaction ID: ${clientTxId}\n\nMy question: `;
  }, [finalActivity, statusSign, clientTxId]);

  // Show loading if clientTxId is not ready
  if (!clientTxId) {
    return (
      <PageLayout desktopOnly isLoading>
        <View />
      </PageLayout>
    );
  }

  // Card transaction
  if (isCardTransaction && cardTransaction && !isAnyLoading) {
    return <CardTransactionDetail transaction={cardTransaction} />;
  }

  // Loading
  if (!finalActivity && isAnyLoading) {
    return (
      <PageLayout desktopOnly isLoading>
        <View />
      </PageLayout>
    );
  }

  // Not found
  if (!finalActivity) {
    return (
      <PageLayout desktopOnly>
        <View className="mx-auto w-full max-w-lg gap-8 px-4 py-8 md:gap-16 md:py-12">
          <Back title={`Transaction ${eclipseAddress(clientTxId)} not found`} />
        </View>
      </PageLayout>
    );
  }

  return (
    <PageLayout desktopOnly isLoading={isAnyLoading}>
      <View className="mx-auto w-full max-w-lg flex-1 gap-10 px-4 py-8 pb-32 md:py-12">
        <Back title={finalActivity.title} className="text-xl md:text-3xl" />

        <View className="items-center gap-4">
          {tokenIcon && <RenderTokenIcon tokenIcon={tokenIcon} size={75} />}

          <View className="items-center">
            <Text className={cn('text-2xl font-bold', statusTextColor)}>
              {statusSign}
              {formatNumber(Number(finalActivity.amount))} {formatSymbol(finalActivity.symbol)}
            </Text>
            <Text className="mt-2 font-semibold text-muted-foreground">{description}</Text>
            <Text className="font-semibold text-muted-foreground">
              {format(Number(finalActivity.timestamp) * 1000, DATE_FORMAT)}
            </Text>
          </View>
        </View>

        <View className="rounded-twice bg-card">
          {rows.map((row, index) => (
            <Row
              key={row.key}
              label={row.label}
              value={row.value}
              isLast={index === rows.length - 1}
            />
          ))}
        </View>

        {isCancelWithdraw && (
          <Button
            onPress={handleCancelWithdraw}
            variant="secondary"
            className="h-14 rounded-xl border-0"
          >
            <X color="white" size={16} />
            <Text className="text-base">Cancel Withdraw</Text>
          </Button>
        )}

        <SupportSection transactionContext={transactionContext} />
      </View>
    </PageLayout>
  );
}
