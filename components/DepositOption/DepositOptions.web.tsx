import { useEffect } from 'react';
import { View } from 'react-native';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useDepositBuyCryptoOptions from '@/hooks/useDepositBuyCryptoOptions';
import useDepositExternalWalletOptions from '@/hooks/useDepositExternalWalletOptions';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { DepositMethod } from '@/lib/types';

import DepositOption from './DepositOption';

type DepositOptionProps = {
  text: string;
  subtitle?: string;
  icon: React.ReactNode;
  onPress: () => void;
  isLoading?: boolean;
  isComingSoon?: boolean;
  isEnabled?: boolean;
  bannerText?: string;
  chipText?: string;
  method?: DepositMethod;
};

const DepositOptions = () => {
  const { user } = useUser();
  const { externalWalletOptions } = useDepositExternalWalletOptions();
  const { buyCryptoOptions } = useDepositBuyCryptoOptions();
  const { depositConfig } = useVaultDepositConfig();

  // Track when deposit options are viewed
  useEffect(() => {
    track(TRACKING_EVENTS.DEPOSIT_OPTIONS_VIEWED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      is_first_deposit: !user?.isDeposited,
    });
  }, [user?.userId, user?.safeAddress, user?.isDeposited]);

  const depositOptions: DepositOptionProps[] = [...externalWalletOptions, ...buyCryptoOptions];

  return (
    <View className="gap-y-2.5">
      {depositOptions
        .filter(option => (option.isEnabled ?? true) && (!option.method || depositConfig.methods.includes(option.method)))
        .map(option => (
        <DepositOption
          key={option.text}
          text={option.text}
          subtitle={option.subtitle}
          icon={option.icon}
          onPress={option.onPress}
          isLoading={option.isLoading}
          bannerText={option.bannerText}
          chipText={option.chipText}
        />
      ))}
    </View>
  );
};

export default DepositOptions;
