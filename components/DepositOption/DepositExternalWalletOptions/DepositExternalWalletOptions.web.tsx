import { View } from 'react-native';

import DepositOption from '@/components/DepositOption/DepositOption';
import useDepositExternalWalletOptions from '@/hooks/useDepositExternalWalletOptions';

const DepositExternalWalletOptions = () => {
  const { externalWalletOptions } = useDepositExternalWalletOptions();

  return (
    <View className="gap-y-2.5">
      {externalWalletOptions.map(option => (
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
