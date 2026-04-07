import { View } from 'react-native';

import DepositOption from '@/components/DepositOption/DepositOption';
import useDepositExternalWalletOptions from '@/hooks/useDepositExternalWalletOptions';
import { getVaultDepositConfig } from '@/lib/vaults';

const DepositExternalWalletOptions = () => {
  const { externalWalletOptions } = useDepositExternalWalletOptions();
  const depositConfig = getVaultDepositConfig();

  return (
    <View className="gap-y-2.5">
      {externalWalletOptions
        .filter(option => !option.method || depositConfig.methods.includes(option.method))
        .map(option => (
          <DepositOption
            key={option.text}
            text={option.text}
            subtitle={option.subtitle}
            icon={option.icon}
            onPress={option.onPress}
            isLoading={option.isLoading}
          />
        ))}
    </View>
  );
};

export default DepositExternalWalletOptions;
