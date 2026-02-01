import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import DepositOption from '@/components/DepositOption/DepositOption';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { DepositMethod } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

const DepositExternalWalletOptions = () => {
  const setModal = useDepositStore(state => state.setModal);
  const { depositConfig } = useVaultDepositConfig();

  const handleDepositDirectly = useCallback(async () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'deposit_directly',
    });
    setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY);
  }, [setModal]);

  const externalWalletOptions = useMemo(
    () => [
      {
        text: 'Deposit directly',
        subtitle: 'Send USDC directly from any network',
        icon: (
          <Image
            source={getAsset('images/deposit_from_external_wallet.png')}
            style={{ width: 28, height: 12 }}
            contentFit="contain"
          />
        ),
        onPress: handleDepositDirectly,
        method: 'deposit_directly' as DepositMethod,
      },
    ],
    [handleDepositDirectly],
  );

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
          />
        ))}
    </View>
  );
};

export default DepositExternalWalletOptions;
