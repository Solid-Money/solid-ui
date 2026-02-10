import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useDepositBuyCryptoOptions from '@/hooks/useDepositBuyCryptoOptions';
import useDepositExternalWalletOptionsNative from '@/hooks/useDepositExternalWalletOptionsNative';
import useUser from '@/hooks/useUser';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { track } from '@/lib/analytics';

import DepositOption from './DepositOption';

const DepositOptions = () => {
  const { user } = useUser();
  const { externalWalletOptions } = useDepositExternalWalletOptionsNative();
  const { buyCryptoOptions } = useDepositBuyCryptoOptions();
  const { depositConfig } = useVaultDepositConfig();

  useEffect(() => {
    track(TRACKING_EVENTS.DEPOSIT_OPTIONS_VIEWED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      is_first_deposit: !user?.isDeposited,
    });
  }, [user?.userId, user?.safeAddress, user?.isDeposited]);

  const depositOptions = useMemo(
    () => [...externalWalletOptions, ...buyCryptoOptions],
    [externalWalletOptions, buyCryptoOptions],
  );

  return (
    <View className="gap-y-2.5">
      {depositOptions
        .filter(option => !option.method || depositConfig.methods.includes(option.method))
        .map(option => (
          <DepositOption
            key={option.text}
            text={option.text}
            subtitle={option.subtitle}
            icon={option.icon}
            onPress={option.onPress}
            bannerText={(option as any).bannerText}
          />
        ))}
    </View>
  );
};

export default DepositOptions;
