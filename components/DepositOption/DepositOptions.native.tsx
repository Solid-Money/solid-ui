import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useDepositBuyCryptoOptions from '@/hooks/useDepositBuyCryptoOptions';
import useDepositExternalWalletOptionsNative from '@/hooks/useDepositExternalWalletOptionsNative';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getVaultDepositConfig } from '@/lib/vaults';

import DepositOption from './DepositOption';

const DepositOptions = () => {
  const { user } = useUser();
  const { externalWalletOptions } = useDepositExternalWalletOptionsNative();
  const { buyCryptoOptions } = useDepositBuyCryptoOptions();
  const depositConfig = getVaultDepositConfig();

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
  const availableOptions = useMemo(
    () =>
      depositOptions.filter(
        option => !option.method || depositConfig.methods.includes(option.method),
      ),
    [depositOptions, depositConfig.methods],
  );

  return (
    <View className="gap-y-2.5">
      {availableOptions.length === 0 ? (
        <View className="rounded-2xl bg-card px-5 py-6">
          <Text className="text-base font-semibold text-primary">No deposit methods available</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Try switching vaults or check your account setup.
          </Text>
        </View>
      ) : (
        availableOptions.map(option => (
          <DepositOption
            key={option.text}
            text={option.text}
            subtitle={option.subtitle}
            icon={option.icon}
            onPress={option.onPress}
            bannerText={(option as any).bannerText}
          />
        ))
      )}
    </View>
  );
};

export default DepositOptions;
