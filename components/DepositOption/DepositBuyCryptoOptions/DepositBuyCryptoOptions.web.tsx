import { View } from 'react-native';

import DepositOption from '@/components/DepositOption/DepositOption';
import useDepositBuyCryptoOptions from '@/hooks/useDepositBuyCryptoOptions';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';

const DepositBuyCryptoOptions = () => {
  const { buyCryptoOptions } = useDepositBuyCryptoOptions();
  const { depositConfig } = useVaultDepositConfig();

  return (
    <View className="gap-y-2.5">
      {buyCryptoOptions
        .filter(option => !option.method || depositConfig.methods.includes(option.method))
        .map(option => (
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
