import { useMemo } from 'react';
import { Platform } from 'react-native';

import { isCountryRestricted } from '@/constants/compliance';
import { useCountryStore } from '@/store/useCountryStore';

export default function useGeoCompliance() {
  const countryInfo = useCountryStore(state => state.countryInfo);

  return useMemo(() => {
    if (Platform.OS !== 'ios') {
      return {
        isRestricted: false,
        isSwapAvailable: true,
        isBridgeAvailable: true,
        isBuyCryptoAvailable: true,
        isBankTransferAvailable: true,
        countryCode: countryInfo?.countryCode ?? '',
        isLoading: false,
      };
    }

    const isLoading = countryInfo === null;
    const countryCode = countryInfo?.countryCode ?? '';
    const isRestricted = !isLoading && isCountryRestricted(countryCode, 'swap');

    return {
      isRestricted,
      isSwapAvailable: isLoading || !isCountryRestricted(countryCode, 'swap'),
      isBridgeAvailable: isLoading || !isCountryRestricted(countryCode, 'bridge'),
      isBuyCryptoAvailable: isLoading || !isCountryRestricted(countryCode, 'buyCrypto'),
      isBankTransferAvailable: isLoading || !isCountryRestricted(countryCode, 'bankTransfer'),
      countryCode,
      isLoading,
    };
  }, [countryInfo]);
}
