import { useCallback } from 'react';
import { View } from 'react-native';
import { ConnectEmbed } from 'thirdweb/react';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { client, thirdwebTheme, thirdwebWallets } from '@/lib/thirdweb';
import { useDepositStore } from '@/store/useDepositStore';

import type { Wallet } from 'thirdweb/wallets';

const DepositWalletConnector = () => {
  const setModal = useDepositStore(state => state.setModal);

  const handleConnect = useCallback(
    (wallet: Wallet) => {
      track(TRACKING_EVENTS.DEPOSIT_WALLET_CONNECTION_SUCCESS, {
        wallet_type: wallet.id,
        deposit_method: 'wallet',
      });
      setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
    },
    [setModal],
  );

  return (
    <View className="flex-1">
      <ConnectEmbed
        client={client}
        wallets={thirdwebWallets}
        theme={thirdwebTheme}
        onConnect={handleConnect}
      />
    </View>
  );
};

export default DepositWalletConnector;
