import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';

interface FundWalletProps {
  className?: string;
}

const FundWallet = ({ className }: FundWalletProps) => {
  const { isScreenMedium } = useDimension();

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: 'accent',
          className: 'h-12 w-36 rounded-xl',
        })}
      >
        <View className="flex-row items-center gap-4">
          <Text className="text-base font-bold">Add funds</Text>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['rgba(126, 126, 126, 0.3)', 'rgba(126, 126, 126, 0.2)']}
      style={{
        borderRadius: 20,
        padding: isScreenMedium ? 40 : 20,
      }}
      className={className}
    >
      <View className="h-full flex-col justify-between gap-y-4 md:flex-row">
        <View className="justify-between gap-4">
          <View className="gap-2">
            <Text className="max-w-lg text-3xl font-semibold">Fund your wallet</Text>
            <Text className="text-base text-muted-foreground md:max-w-60">
              Fund your account with crypto you already own or with cash
            </Text>
          </View>
          <DepositOptionModal trigger={getTrigger()} />
        </View>
        <View>
          <Image
            source={getAsset('images/fund-wallet-tokens.png')}
            contentFit="contain"
            style={{ width: 216, height: 216 }}
            alt="Cryptocurrency tokens including USDC, USDT, and ETH"
          />
        </View>
      </View>
    </LinearGradient>
  );
};

export default FundWallet;
