import { DEPOSIT_MODAL } from '@/constants/modals';
import { client } from '@/lib/thirdweb';
import { useDepositStore } from '@/store/useDepositStore';
import { Image } from 'expo-image';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { ConnectButton, useActiveAccount } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
import DepositOption from '../DepositOption';

const DepositExternalWalletOptions = () => {
  const activeAccount = useActiveAccount();
  const { setModal } = useDepositStore();
  const address = activeAccount?.address;

  // Navigate to networks when wallet is connected
  useEffect(() => {
    if (address) {
      setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
    }
  }, [address, setModal]);

  const handleDepositDirectly = useCallback(async () => {
    // TODO: Implement deposit directly flow with API
    setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY);
  }, [setModal]);

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
        />
      ))}
      <ConnectButton
        client={client}
        wallets={[
          // createWallet('walletConnect'),
          createWallet('io.rabby'),
          createWallet('io.metamask'),
        ]}
        connectButton={{
          label: address ? 'Wallet Connected' : 'Wallet connect',
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
    </View>
  );
};

export default DepositExternalWalletOptions;
