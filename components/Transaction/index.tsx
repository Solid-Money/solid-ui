import { Platform, View } from 'react-native';

import { useDimension } from '@/hooks/useDimension';
import getTokenIcon from '@/lib/getTokenIcon';
import { LayerZeroTransactionStatus, TransactionType } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import RenderTokenIcon from '../RenderTokenIcon';
import { Text } from '../ui/text';
import TransactionDrawer from './TransactionDrawer';
import TransactionDropdown from './TransactionDropdown';
import useCancelOnchainWithdraw from '@/hooks/useCancelOnchainWithdraw';

type TransactionClassNames = {
  container?: string;
};

interface TransactionProps {
  title: string;
  timestamp: string;
  amount: number;
  status: LayerZeroTransactionStatus;
  hash?: string;
  type: TransactionType;
  classNames?: TransactionClassNames;
  symbol?: string;
  url?: string;
  logoUrl?: string;
  requestId?: `0x${string}`;
}

const Transaction = ({
  title,
  timestamp,
  amount,
  status,
  classNames,
  symbol,
  url,
  logoUrl,
  requestId,
}: TransactionProps) => {
  const { isScreenMedium } = useDimension();
  const isSuccess = status === LayerZeroTransactionStatus.DELIVERED;
  const isPending =
    status === LayerZeroTransactionStatus.INFLIGHT ||
    status === LayerZeroTransactionStatus.CONFIRMING;

  const statusBgColor = isSuccess
    ? 'bg-brand/10'
    : isPending
      ? 'bg-yellow-400/10'
      : 'bg-red-400/10';
  const statusTextColor = isSuccess ? 'text-brand' : isPending ? 'text-yellow-400' : 'text-red-400';
  const statusText = isSuccess ? 'Success' : isPending ? 'Pending' : 'Failed';

  const tokenIcon = getTokenIcon({
    logoUrl,
    tokenSymbol: symbol,
    size: 34,
  });

  const { cancelOnchainWithdraw } = useCancelOnchainWithdraw();

  const handleCancelWithdraw = async () => {
    if (!requestId) return;
    await cancelOnchainWithdraw(requestId);
  };

  return (
    <View
      className={cn(
        'flex-row items-center justify-between bg-card border-b border-border/40 p-4 md:px-6',
        classNames?.container,
      )}
    >
      <View className="flex-row items-center gap-2 md:gap-4">
        <RenderTokenIcon tokenIcon={tokenIcon} size={34} />
        <View>
          <Text className="text-lg font-medium">{title}</Text>
          <Text className="text-sm text-muted-foreground">
            {new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              hour12: true,
            })}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2 md:gap-4">
        <Text className="text-lg font-medium">${formatNumber(amount)}</Text>
        {isScreenMedium && (
          <View className={cn('w-20 h-8 rounded-twice items-center justify-center', statusBgColor)}>
            <Text className={cn('text-sm font-bold', statusTextColor)}>{statusText}</Text>
          </View>
        )}
        {Platform.OS === 'web' ? (
          <TransactionDropdown
            url={url}
            showCancelButton={status === LayerZeroTransactionStatus.INFLIGHT && !!requestId}
            onCancelWithdraw={handleCancelWithdraw}
          />
        ) : (
          <TransactionDrawer
            url={url}
            showCancelButton={status === LayerZeroTransactionStatus.INFLIGHT && !!requestId}
            onCancelWithdraw={handleCancelWithdraw}
          />
        )}
      </View>
    </View>
  );
};

export default Transaction;
