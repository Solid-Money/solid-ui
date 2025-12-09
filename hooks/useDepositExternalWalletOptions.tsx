import { Wallet } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useActiveAccount, useConnectModal } from 'thirdweb/react';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { client, thirdwebTheme, thirdwebWallets } from '@/lib/thirdweb';
import { useDepositStore } from '@/store/useDepositStore';
import { useDimension } from './useDimension';

import HomeQR from '@/assets/images/home-qr';

const useDepositExternalWalletOptions = () => {
  const activeAccount = useActiveAccount();
  const { connect } = useConnectModal();
  const { setModal } = useDepositStore();
  const { isScreenMedium } = useDimension();
  const address = activeAccount?.address;

  const [isWalletOpen, setIsWalletOpen] = useState(false);

  const handleDepositDirectly = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'deposit_directly',
    });
    setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY);
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
    }
  }, [isWalletOpen, connect, address, setModal]);

  const externalWalletOptions = useMemo(
    () => [
      {
        text: 'Send from your crypto wallet',
        subtitle: 'Add USDC from supported networks\ndirectly to your account',
        icon: <Wallet color="white" size={24} strokeWidth={1} />,
        onPress: openWallet,
        isLoading: isWalletOpen,
        isEnabled: isScreenMedium,
      },
      {
        text: 'Share your deposit address',
        subtitle:
          'Send supported assets to your solid\ndeposit address from any supported\nnetwork',
        icon: <HomeQR />,
        onPress: handleDepositDirectly,
      },
    ],
    [openWallet, isWalletOpen, isScreenMedium, handleDepositDirectly],
  );

  return { externalWalletOptions };
};

export default useDepositExternalWalletOptions;