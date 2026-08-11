import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { CreditCard, Wallet } from 'lucide-react-native';
import { useActiveAccount, useConnectModal } from 'thirdweb/react';

import HomeQR from '@/assets/images/home-qr';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useGeoCompliance from '@/hooks/useGeoCompliance';
import { track } from '@/lib/analytics';
import { cleanupThirdwebStyles, client, thirdwebTheme, thirdwebWallets } from '@/lib/thirdweb';
import { DepositMethod } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

import { useBuyCryptoEntry } from './useBuyCryptoEntry';
import { useDimension } from './useDimension';

const useDepositExternalWalletOptions = () => {
  const activeAccount = useActiveAccount();
  const { connect } = useConnectModal();
  const setModal = useDepositStore(state => state.setModal);
  const { isScreenMedium } = useDimension();
  const { isBuyCryptoAvailable } = useGeoCompliance();
  const { handleBuyCryptoPress, isChecking: isBuyCryptoChecking } = useBuyCryptoEntry();
  const address = activeAccount?.address;

  const [isWalletOpen, setIsWalletOpen] = useState(false);

  const handleDepositDirectly = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'deposit_directly',
    });
    // Show user's Safe address directly — no backend session needed
    setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  }, [setModal]);

  const openWallet = useCallback(async () => {
    try {
      if (isWalletOpen) return;

      if (address) {
        track(TRACKING_EVENTS.DEPOSIT_WALLET_ALREADY_CONNECTED, {
          wallet_address: address,
          deposit_method: 'wallet',
        });
        setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
        return;
      }

      track(TRACKING_EVENTS.DEPOSIT_WALLET_CONNECTION_STARTED, {
        deposit_method: 'wallet',
      });

      setIsWalletOpen(true);
      const wallet = await connect({
        client,
        showThirdwebBranding: false,
        size: 'compact',
        wallets: thirdwebWallets,
        theme: thirdwebTheme,
      });

      if (wallet) {
        track(TRACKING_EVENTS.DEPOSIT_WALLET_CONNECTION_SUCCESS, {
          wallet_type: wallet.id,
          deposit_method: 'wallet',
        });
        setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
      }
    } catch (error) {
      console.error(error);
      track(TRACKING_EVENTS.DEPOSIT_WALLET_CONNECTION_FAILED, {
        error: String(error),
        deposit_method: 'wallet',
      });
    } finally {
      setIsWalletOpen(false);
      cleanupThirdwebStyles();
    }
  }, [isWalletOpen, connect, address, setModal]);

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
        text: 'Send from your crypto wallet',
        subtitle: isScreenMedium
          ? 'Add supported assets from supported\nnetworks directly to your account'
          : 'Add supported assets from supported networks directly to your account',
        icon: <Wallet color="white" size={24} strokeWidth={1} />,
        onPress: openWallet,
        isLoading: isWalletOpen,
        isEnabled: isScreenMedium,
        method: 'wallet' as DepositMethod,
      },
      {
        text: 'Share your deposit address',
        subtitle: isScreenMedium
          ? 'Send supported tokens to your Solid\naddress from a supported network'
          : 'Send supported tokens to your Solid address from a supported network',
        icon: <HomeQR />,
        onPress: handleDepositDirectly,
        method: 'deposit_directly' as DepositMethod,
      },
    ];

    if (isBuyCryptoAvailable) {
      base.push({
        text: 'Buy crypto',
        subtitle: 'Buy USDC with your card or bank',
        icon: <CreditCard color="white" size={24} strokeWidth={1} />,
        onPress: handleBuyCryptoPress,
        isLoading: isBuyCryptoChecking,
        isEnabled: true,
        method: 'buy_crypto' as DepositMethod,
        chipText: 'New',
      });
    }

    return base;
  }, [
    openWallet,
    isWalletOpen,
    isScreenMedium,
    handleDepositDirectly,
    isBuyCryptoAvailable,
    handleBuyCryptoPress,
    isBuyCryptoChecking,
  ]);

  return { externalWalletOptions };
};

export default useDepositExternalWalletOptions;
