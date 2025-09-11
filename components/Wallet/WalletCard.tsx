import { Wallet } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn, fontSize } from '@/lib/utils';
import TooltipPopover from '@/components/Tooltip';
import { TokenBalance } from '@/lib/types';
import WalletCardIcons from '@/components/Wallet/WalletCardIcons';
import CountUp from '@/components/CountUp';
import { useDimension } from '@/hooks/useDimension';

type WalletCardProps = {
  balance: number;
  className?: string;
  tokens: TokenBalance[];
};

const WalletCard = ({ balance, className, tokens }: WalletCardProps) => {
  const { isScreenMedium } = useDimension();

  return (
    <View className={cn('bg-card rounded-twice p-6 justify-between w-full h-full', className)}>
      <View className="flex-row items-center gap-2 opacity-50">
        <Wallet size={18} />
        <Text className="text-lg font-semibold">Wallet</Text>
      </View>

      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center">
            <Text className="text-2xl md:text-3xl font-semibold native:leading-[1.2]">$</Text>
            <CountUp
              count={balance ?? 0}
              isTrailingZero={false}
              classNames={{
                wrapper: 'text-foreground',
                decimalSeparator: 'text-2xl md:text-3xl font-semibold',
              }}
              styles={{
                wholeText: {
                  fontSize: isScreenMedium ? fontSize(1.875) : fontSize(1.5),
                  fontWeight: 'semibold',
                  fontFamily: 'MonaSans_600SemiBold',
                  color: '#ffffff',
                  marginRight: -1,
                },
                decimalText: {
                  fontSize: isScreenMedium ? fontSize(1.875) : fontSize(1.5),
                  fontWeight: 'semibold',
                  fontFamily: 'MonaSans_600SemiBold',
                  color: '#ffffff',
                },
              }}
            />
          </View>
          <TooltipPopover text="All coins balance excluding staked soUSD" />
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
