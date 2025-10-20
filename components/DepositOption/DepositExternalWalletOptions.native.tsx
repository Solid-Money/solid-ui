import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { client } from '@/lib/thirdweb';
import { useDepositStore } from '@/store/useDepositStore';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useActiveAccount, useConnectModal } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
import DepositOption from './DepositOption';

const DepositExternalWalletOptions = () => {
  const activeAccount = useActiveAccount();
  const { connect } = useConnectModal();
  const { setModal } = useDepositStore();
  const address = activeAccount?.address;

  const [isWalletOpen, setIsWalletOpen] = useState(false);

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
      text: 'Deposit directly',
      subtitle: 'Send USDC directly from any network',
      icon: (
        <Image
          source={require('@/assets/images/deposit_from_external_wallet.png')}
          style={{ width: 28, height: 12 }}
          contentFit="contain"
        />
      ),
      onPress: handleDepositDirectly,
    },
    {
      text: 'Wallet connect',
      subtitle: 'Transfer from your favorite wallet',
      icon: (
        <Image
          source={require('@/assets/images/wallet_connect.png')}
          style={{ width: 26, height: 26 }}
          contentFit="contain"
        />
      ),
      onPress: openWallet,
      isLoading: isWalletOpen,
    },
  ];

  return (
    <View className="gap-y-2.5">
      {EXTERNAL_WALLET_OPTIONS.map(option => (
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

export default DepositExternalWalletOptions;
