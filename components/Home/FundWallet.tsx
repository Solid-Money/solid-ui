import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { DepositOptionModal } from '@/components/DepositOption';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';

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
          className: 'w-36 h-12 rounded-xl',
        })}
      >
        <View className="flex-row items-center gap-4">
          <Text className="font-bold">Add funds</Text>
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
      <View className="flex-col md:flex-row justify-between gap-y-4 h-full">
        <View className="justify-between gap-4">
          <View className="gap-2">
            <Text className="text-3xl font-semibold max-w-lg">Fund your wallet</Text>
            <Text className="text-muted-foreground md:max-w-60">
              Fund your account with crypto you already own or with cash
            </Text>
          </View>
          <DepositOptionModal trigger={getTrigger()} />
        </View>
        <View>
          <Image
            source={require('@/assets/images/fund-wallet-tokens.png')}
            contentFit="contain"
            style={{ width: 216, height: 216 }}
          />
        </View>
      </View>
    </LinearGradient>
  );
};

export default FundWallet;
