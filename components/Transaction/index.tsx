import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Text } from '@/components/ui/text';
import getTokenIcon from '@/lib/getTokenIcon';
import {
  TransactionCategory,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { TRANSACTION_DETAILS } from '@/constants/transaction';

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
}: TransactionProps) => {
  const isFailed = status === TransactionStatus.FAILED;
  const isIncoming = TRANSACTION_DETAILS[type].sign === TransactionDirection.IN;
  const isReward = TRANSACTION_DETAILS[type].category === TransactionCategory.REWARD;

  const statusTextColor = isFailed ? 'text-red-400' : isIncoming ? 'text-brand' : '';
  const statusSign = isFailed ? TransactionDirection.FAILED : TRANSACTION_DETAILS[type].sign;

  const tokenIcon = getTokenIcon({
    logoUrl,
    tokenSymbol: symbol,
    size: 34,
  });

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
          <View className="flex-row items-center gap-1">
            {isReward && (
              <Image
                source={require('@/assets/images/green-diamond.png')}
                style={{ width: 12, height: 12 }}
                contentFit="contain"
              />
            )}
            <Text
              className={cn('text-sm text-muted-foreground font-medium', isReward && 'text-brand')}
              numberOfLines={1}
            >
              {TRANSACTION_DETAILS[type].category}
            </Text>
          </View>
        </View>
      </View>
      <View className="flex-row items-center gap-2 md:gap-4 flex-shrink-0">
        <Text className={cn('text-lg font-medium text-right', statusTextColor)}>
          {statusSign}${formatNumber(Number(amount))}
        </Text>
      </View>
    </Pressable>
  );
};

export default Transaction;
