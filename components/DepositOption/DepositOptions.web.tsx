import { useEffect } from 'react';
import { View } from 'react-native';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import DepositOption from './DepositOption';
import useDepositExternalWalletOptions from '@/hooks/useDepositExternalWalletOptions';
import useDepositBuyCryptoOptions from '@/hooks/useDepositBuyCryptoOptions';

type DepositOptionProps = {
  text: string;
  subtitle?: string;
  icon: React.ReactNode;
  onPress: () => void;
  isLoading?: boolean;
  isComingSoon?: boolean;
};

const DepositOptions = () => {
  const { user } = useUser();
  const { EXTERNAL_WALLET_OPTIONS } = useDepositExternalWalletOptions();
  const { BUY_CRYPTO_OPTIONS } = useDepositBuyCryptoOptions();

  // Track when deposit options are viewed
  useEffect(() => {
    track(TRACKING_EVENTS.DEPOSIT_OPTIONS_VIEWED, {
      user_id: user?.userId,
      safe_address: user?.safeAddress,
      is_first_deposit: !user?.isDeposited,
    });
  }, [user?.userId, user?.safeAddress, user?.isDeposited]);

  const DEPOSIT_OPTIONS: DepositOptionProps[] = [...EXTERNAL_WALLET_OPTIONS, ...BUY_CRYPTO_OPTIONS];

  return (
    <View className="gap-y-2.5">
      {DEPOSIT_OPTIONS.map(option => (
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

export default DepositOptions;
