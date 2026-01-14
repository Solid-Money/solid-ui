import { View } from 'react-native';

import CardIcon from '@/assets/images/card';
import CountUp from '@/components/CountUp';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import WalletCardIcons from '@/components/Wallet/WalletCardIcons';
import { useDimension } from '@/hooks/useDimension';
import { TokenBalance } from '@/lib/types';
import { cn, fontSize } from '@/lib/utils';

type CardProps = {
  balance: number;
  className?: string;
  tokens: TokenBalance[];
  isLoading?: boolean;
  decimalPlaces?: number;
};

const Card = ({ balance, className, tokens, isLoading, decimalPlaces }: CardProps) => {
  const { isScreenMedium } = useDimension();

  return (
    <View
      className={cn(
        'h-full w-full justify-between rounded-twice bg-card p-[30px] pb-[21px]',
        className,
      )}
    >
      <View className="flex-row items-center gap-2 opacity-50">
        <CardIcon />
        <Text className="text-lg font-medium">Card</Text>
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center">
            {isLoading ? (
              <Skeleton className="h-11 w-36 rounded-xl" />
            ) : (
              <CountUp
                prefix="$"
                count={balance ?? 0}
                isTrailingZero={false}
                decimalPlaces={decimalPlaces}
                classNames={{
                  wrapper: 'text-foreground',
                  decimalSeparator: 'text-2xl md:text-3xl font-semibold',
                }}
                styles={{
                  wholeText: {
                    fontSize: isScreenMedium ? fontSize(1.875) : fontSize(1.5),
                    fontWeight: '500',
                    color: '#ffffff',
                    marginRight: -1,
                  },
                  decimalText: {
                    fontSize: isScreenMedium ? fontSize(1.875) : fontSize(1.5),
                    fontWeight: '500',
                    color: '#ffffff',
                  },
                }}
              />
            )}
          </View>
        </View>
        <WalletCardIcons tokens={tokens} />
      </View>
    </View>
  );
};

export default Card;
