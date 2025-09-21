import { Platform, Pressable, View } from 'react-native';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import useCancelOnchainWithdraw from '@/hooks/useCancelOnchainWithdraw';
import { useDimension } from '@/hooks/useDimension';
import getTokenIcon from '@/lib/getTokenIcon';
import { TransactionStatus, TransactionType } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import TransactionDrawer from './TransactionDrawer';
import TransactionDropdown from './TransactionDropdown';

type TransactionClassNames = {
  container?: string;
};

interface TransactionProps {
  title: string;
  shortTitle?: string;
  timestamp: string;
  amount: string;
  status: TransactionStatus;
  hash?: string;
  type: TransactionType;
  classNames?: TransactionClassNames;
  symbol?: string;
  url?: string;
  logoUrl?: string;
  requestId?: `0x${string}`;
  onPress?: () => void;
}

const Transaction = ({
  title,
  shortTitle,
  timestamp,
  amount,
  status,
  classNames,
  symbol,
  url,
  logoUrl,
  requestId,
  onPress,
  type,
}: TransactionProps) => {
  const { isScreenMedium } = useDimension();

  const isSuccess = status === TransactionStatus.SUCCESS;
  const isPending = status === TransactionStatus.PENDING;

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
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-between p-4 md:px-6',
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
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
            {', '}
            {new Date(Number(timestamp) * 1000).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2 md:gap-4 flex-shrink-0">
        <Text className="text-lg font-medium text-right">${formatNumber(Number(amount))}</Text>
        {isScreenMedium && (
          <View className={cn('w-20 h-8 rounded-twice items-center justify-center', statusBgColor)}>
            <Text className={cn('text-sm font-bold', statusTextColor)}>{statusText}</Text>
          </View>
        )}
        {Platform.OS === 'web' ? (
          <TransactionDropdown
            url={url}
            showCancelButton={status === TransactionStatus.PENDING && !!requestId}
            onCancelWithdraw={handleCancelWithdraw}
            type={type}
            onPress={onPress}
          />
        ) : (
          <TransactionDrawer
            url={url}
            showCancelButton={status === TransactionStatus.PENDING && !!requestId}
            onCancelWithdraw={handleCancelWithdraw}
            type={type}
            onPress={onPress}
          />
        )}
      </View>
    </Pressable>
  );
};

export default Transaction;
