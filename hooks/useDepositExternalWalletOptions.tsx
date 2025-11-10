import { Wallet } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useActiveAccount, useConnectModal } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { client } from '@/lib/thirdweb';
import { useDepositStore } from '@/store/useDepositStore';

import HomeQR from '@/assets/images/home-qr';

const useDepositExternalWalletOptions = () => {
  // eslint-disable-next-line no-console
  console.log('[DepositExternalWalletOptions] Component mounting/rendering');

  const activeAccount = useActiveAccount();
  const { connect } = useConnectModal();
  const { setModal } = useDepositStore();
  const address = activeAccount?.address;

  const [isWalletOpen, setIsWalletOpen] = useState(false);

  // eslint-disable-next-line no-console
  console.log('[DepositExternalWalletOptions] State:', { address, isWalletOpen });

  const handleDepositDirectly = useCallback(async () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'deposit_directly',
    });

    setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY);
  }, [setModal]);

  const openWallet = useCallback(async () => {
    try {
      if (isWalletOpen) return;

      // If wallet is already connected, go directly to form
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
        wallets: [
          // createWallet('walletConnect'),
          createWallet('io.rabby'),
          createWallet('io.metamask'),
        ],
      });

      // Only proceed to form if wallet connection was successful
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

      // Don't change modal state on error - user can try again
    } finally {
      setIsWalletOpen(false);
    }
  }, [isWalletOpen, connect, address, setModal]);

  const EXTERNAL_WALLET_OPTIONS = [
    {
      text: 'Send from your crypto wallet',
      subtitle: 'Add USDC from supported networks\ndirectly to your account',
      icon: (
        <Wallet color="white" size={24} strokeWidth={1} />
      ),
      onPress: openWallet,
      isLoading: isWalletOpen,
    },
    {
      text: 'Share your deposit address',
      subtitle: 'Send supported assets to your solid\ndeposit address from any supported\nnetwork',
      icon: (
        <HomeQR />
      ),
      onPress: handleDepositDirectly,
    },
  ];

  // eslint-disable-next-line no-console
  console.log(
    '[DepositExternalWalletOptions] Rendering with options:',
    EXTERNAL_WALLET_OPTIONS.length,
  );

  return { EXTERNAL_WALLET_OPTIONS };
};

export default useDepositExternalWalletOptions;
