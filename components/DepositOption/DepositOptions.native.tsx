import { DEPOSIT_MODAL } from '@/constants/modals';
import { client } from '@/lib/thirdweb';
import { useDepositStore } from '@/store/useDepositStore';
import { Image } from 'expo-image';
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

  const handleBuyCryptoPress = useCallback(() => {
    setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_OPTIONS);
  }, [setModal]);

  const handlePublicAddressPress = useCallback(() => {
    setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  }, [setModal]);

  const DEPOSIT_OPTIONS = [
    {
      text: 'Buy crypto',
      subtitle: 'Google Pay, card or bank account',
      icon: (
        <Image
          source={require('@/assets/images/buy_crypto.png')}
          style={{ width: 22, height: 17 }}
          contentFit="contain"
        />
      ),
      onPress: handleBuyCryptoPress,
    },
    {
      text: 'Public address',
      subtitle: 'Receive crypto directly to your wallet',
      icon: (
        <Image
          source={require('@/assets/images/public_address.png')}
          style={{ width: 26, height: 26 }}
          contentFit="contain"
        />
      ),
      onPress: handlePublicAddressPress,
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
          label: address ? 'Wallet Connected' : 'Deposit from external wallet',
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
          url: 'https://app.solid.xyz',
        }}
      />
      {DEPOSIT_OPTIONS.map(option => (
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

export default DepositOptions;
