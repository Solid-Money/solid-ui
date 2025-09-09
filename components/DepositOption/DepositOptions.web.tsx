import { DEPOSIT_MODAL } from '@/constants/modals';
import { client } from '@/lib/thirdweb';
import { useDepositStore } from '@/store/useDepositStore';
import { CreditCard, Landmark, Wallet } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useActiveAccount, useConnectModal } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
import DepositOption from './DepositOption';
import { track } from '@/lib/firebase';

const DepositOptions = () => {
  const activeAccount = useActiveAccount();
  const { connect } = useConnectModal();
  const { setModal } = useDepositStore();
  const address = activeAccount?.address;

  const [isWalletOpen, setIsWalletOpen] = useState(false);

  const openWallet = useCallback(async () => {
    try {
      if (isWalletOpen) return;

      // If wallet is already connected, go directly to form
      if (address) {
        track('deposit_wallet_already_connected', {
          wallet_address: address,
          deposit_method: 'wallet',
        });
        setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
        return;
      }

      track('deposit_wallet_connection_started', {
        deposit_method: 'wallet',
      });

      setIsWalletOpen(true);
      const wallet = await connect({
        client,
        showThirdwebBranding: false,
        size: 'compact',
        wallets: [
          createWallet('walletConnect'),
          createWallet('io.rabby'),
          createWallet('io.metamask'),
        ],
      });

      // Only proceed to form if wallet connection was successful
      if (wallet) {
        track('deposit_wallet_connection_success', {
          wallet_type: wallet.id,
          deposit_method: 'wallet',
        });
        setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
      }
    } catch (error) {
      console.error(error);
      track('deposit_wallet_connection_failed', {
        error: String(error),
        deposit_method: 'wallet',
      });
      // Don't change modal state on error - user can try again
    } finally {
      setIsWalletOpen(false);
    }
  }, [isWalletOpen, connect, address, setModal]);

  const handleBankDepositPress = useCallback(async () => {
    track('deposit_method_selected', {
      deposit_method: 'bank_transfer',
    });
    setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_AMOUNT);
  }, [setModal]);

  const DEPOSIT_OPTIONS = [
    {
      text: 'Connect Wallet',
      icon: <Wallet color="white" size={26} />,
      onPress: openWallet,
      isLoading: isWalletOpen,
    },
    {
      text: 'Debit/Credit Card',
      icon: <CreditCard color="white" size={26} />,
      onPress: () => {
        track('deposit_method_selected', {
          deposit_method: 'credit_card',
        });
        setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO);
      },
    },
    {
      text: 'Bank Deposit',
      icon: <Landmark color="white" size={26} />,
      onPress: handleBankDepositPress,
      isComingSoon: false,
    },
  ];

  return (
    <View className="gap-y-2.5">
      {DEPOSIT_OPTIONS.map(option => (
        <DepositOption
          key={option.text}
          text={option.text}
          icon={option.icon}
          onPress={option.onPress}
          isLoading={option.isLoading}
          isComingSoon={option.isComingSoon}
        />
      ))}
    </View>
  );
};

export default DepositOptions;
