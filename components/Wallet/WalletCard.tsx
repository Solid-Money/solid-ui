import { Wallet } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import CountUp from '@/components/CountUp';
import TooltipPopover from '@/components/Tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import WalletCardIcons from '@/components/Wallet/WalletCardIcons';
import { useDimension } from '@/hooks/useDimension';
import { TokenBalance } from '@/lib/types';
import { cn, fontSize } from '@/lib/utils';

type WalletCardProps = {
  balance: number;
  className?: string;
  tokens: TokenBalance[];
  isLoading?: boolean;
  decimalPlaces?: number;
};

const WalletCard = ({ balance, className, tokens, isLoading, decimalPlaces }: WalletCardProps) => {
  const { isScreenMedium } = useDimension();

  return (
    <View className={cn('bg-card rounded-twice p-[30px] pb-[21px] justify-between w-full h-full', className)}>
      <View className="flex-row items-center gap-2 opacity-50">
        <Wallet size={18} />
        <Text className="text-lg font-medium">Wallet</Text>
      </View>

      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center">
            {isLoading ? (
              <Skeleton className="w-36 h-11 rounded-xl" />
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
                    //fontFamily: 'MonaSans_600SemiBold',
                    color: '#ffffff',
                    marginRight: -1,
                  },
                  decimalText: {
                    fontSize: isScreenMedium ? fontSize(1.875) : fontSize(1.5),
                    fontWeight: '500',
                    //fontFamily: 'MonaSans_600SemiBold',
                    color: '#ffffff',
                  },
                }}
              />
            )}
          </View>
          <TooltipPopover text="All coins balance excluding soUSD" />
        </View>
        <TooltipPopover
          trigger={
            <Pressable>
              <WalletCardIcons tokens={tokens} />
            </Pressable>
          }
          content={
            <Text className="max-w-[16.2rem]">
              Displaying top three tokens by balance. Wallet can contain any ERC-20 and native token
              in Ethereum and Fuse for Swap and Send.
            </Text>
          }
        />
      </View>
    </View>
  );
};

export default WalletCard;
