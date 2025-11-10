import { View } from 'react-native';

import DepositOption from '@/components/DepositOption/DepositOption';
import useDepositBuyCryptoOptions from '@/hooks/useDepositBuyCryptoOptions';

const DepositBuyCryptoOptions = () => {
  const { BUY_CRYPTO_OPTIONS } = useDepositBuyCryptoOptions();

  return (
    <View className="gap-y-2.5">
      {BUY_CRYPTO_OPTIONS.map(option => (
        <DepositOption
          key={option.text}
          text={option.text}
          subtitle={option.subtitle}
          icon={option.icon}
          onPress={option.onPress}
          isComingSoon={option.isComingSoon}
        />
      ))}
    </View>
  );
};

export default DepositBuyCryptoOptions;
