import { DEPOSIT_MODAL } from '@/constants/modals';
import { client } from '@/lib/thirdweb';
import { useDepositStore } from '@/store/useDepositStore';
import { CreditCard, Landmark } from 'lucide-react-native';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { ConnectButton, useActiveAccount } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
import DepositOption from './DepositOption';

const DepositOptions = () => {
  const activeAccount = useActiveAccount();
  const { setModal } = useDepositStore();
  const address = activeAccount?.address;

  // Navigate to networks when wallet is connected
  useEffect(() => {
    if (address) {
      setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
    }
  }, [address, setModal]);

  const handleBankDepositPress = useCallback(async () => {
    setModal(DEPOSIT_MODAL.OPEN_BANK_TRANSFER_AMOUNT);
  }, [setModal]);

  const DEPOSIT_OPTIONS = [
    {
      text: 'Debit/Credit Card',
      icon: <CreditCard color="white" size={26} />,
      onPress: () => {
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
      <ConnectButton
        client={client}
        wallets={[
          // createWallet('walletConnect'),
          createWallet('io.rabby'),
          createWallet('io.metamask'),
        ]}
        connectButton={{
          label: address ? 'Wallet Connected' : 'Connect Wallet',
          className:
            'flex-row items-center justify-between bg-primary/10 rounded-2xl p-6 disabled:opacity-100 disabled:web:hover:opacity-100',
          style: {
            height: 88,
            textAlign: 'left',
            color: 'red',
          },
        }}
        theme={'dark'}
        appMetadata={{
          name: 'Solid',
          url: 'https://beta.solid.xyz',
        }}
      />
      {DEPOSIT_OPTIONS.map(option => (
        <DepositOption
          key={option.text}
          text={option.text}
          icon={option.icon}
          onPress={option.onPress}
          isComingSoon={option.isComingSoon}
        />
      ))}
    </View>
  );
};

export default DepositOptions;
