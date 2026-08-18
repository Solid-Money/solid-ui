import { type ReactNode, useCallback, useMemo } from 'react';
import { CreditCard } from 'lucide-react-native';

import HomeQR from '@/assets/images/home-qr';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useGeoCompliance from '@/hooks/useGeoCompliance';
import { track } from '@/lib/analytics';
import { DepositMethod } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

import { useBuyCryptoEntry } from './useBuyCryptoEntry';

const useDepositExternalWalletOptionsNative = () => {
  const setModal = useDepositStore(state => state.setModal);
  const { isBuyCryptoAvailable } = useGeoCompliance();
  const { handleBuyCryptoPress, isChecking: isBuyCryptoChecking } = useBuyCryptoEntry();

  const handleDepositDirectly = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'deposit_directly',
    });

    // Show user's Safe address directly — no backend session needed
    setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  }, [setModal]);

  const externalWalletOptions = useMemo(() => {
    const base: {
      text: string;
      subtitle?: string;
      icon: ReactNode;
      onPress: () => void;
      isLoading?: boolean;
      isEnabled?: boolean;
      chipText?: string;
      method: DepositMethod;
    }[] = [
      {
        text: 'Share your deposit address',
        subtitle: 'Send supported tokens to your solid deposit address from any supported network',
        icon: <HomeQR />,
        onPress: handleDepositDirectly,
        method: 'deposit_directly' as DepositMethod,
      },
    ];

    // Mirrors the web list in useDepositExternalWalletOptions — this option is the
    // onramp's only entry point, and only the geo/platform check gates it.
    if (isBuyCryptoAvailable) {
      base.push({
        text: 'Buy crypto',
        subtitle: 'Buy USDC with your card or bank',
        icon: <CreditCard color="white" size={24} strokeWidth={1} />,
        onPress: handleBuyCryptoPress,
        isLoading: isBuyCryptoChecking,
        method: 'buy_crypto' as DepositMethod,
        chipText: 'New',
      });
    }

    return base;
  }, [handleDepositDirectly, isBuyCryptoAvailable, handleBuyCryptoPress, isBuyCryptoChecking]);

  return { externalWalletOptions };
};

export default useDepositExternalWalletOptionsNative;
