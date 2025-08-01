import { DEPOSIT_MODAL } from '@/constants/modals';
import { client } from '@/lib/thirdweb';
import { useDepositStore } from '@/store/useDepositStore';
import { Landmark } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { ConnectButton, useActiveAccount } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
import DepositOption from './DepositOption';

const DepositOptions = () => {
  const activeAccount = useActiveAccount();
  const { setModal } = useDepositStore();
  const address = activeAccount?.address;

  // Navigate to form when wallet is connected
  useEffect(() => {
    if (address) {
      setModal(DEPOSIT_MODAL.OPEN_FORM);
    }
  }, [address, setModal]);

  const DEPOSIT_OPTIONS = [
    {
      text: 'Bank Deposit',
      icon: <Landmark color="white" size={26} />,
      onPress: () => {},
      isComingSoon: true,
    },
  ];

  return (
    <View className="gap-y-2.5">
      <ConnectButton
        client={client}
        wallets={[
          createWallet('walletConnect'),
          createWallet('io.rabby'),
          createWallet('io.metamask'),
        ]}
        connectButton={{
          label: 'Connect Wallet',
        }}
        theme={'light'}
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
