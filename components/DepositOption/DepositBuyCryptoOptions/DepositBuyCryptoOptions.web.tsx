import { View } from 'react-native';

import DepositOption from '@/components/DepositOption/DepositOption';
import useDepositBuyCryptoOptions from '@/hooks/useDepositBuyCryptoOptions';

const DepositBuyCryptoOptions = () => {
  const { buyCryptoOptions } = useDepositBuyCryptoOptions();

  return (
    <View className="gap-y-2.5">
      {buyCryptoOptions.map(option => (
        <DepositOption
          key={option.text}
          text={option.text}
          subtitle={option.subtitle}
          icon={option.icon}
          onPress={option.onPress}
          bannerText={option.bannerText}
        />
      ))}
    </View>
  );
};

export default DepositBuyCryptoOptions;
