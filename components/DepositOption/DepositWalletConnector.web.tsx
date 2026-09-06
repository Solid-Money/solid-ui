import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useActiveAccount, useConnectModal } from 'thirdweb/react';

import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { cleanupThirdwebStyles, client, thirdwebTheme, thirdwebWallets } from '@/lib/thirdweb';
import { useDepositStore } from '@/store/useDepositStore';

const DepositWalletConnector = () => {
  const activeAccount = useActiveAccount();
  const { connect } = useConnectModal();
  const setModal = useDepositStore(state => state.setModal);
  const started = useRef(false);

  useEffect(() => {
    if (activeAccount?.address) {
      setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
      return;
    }
    if (started.current) return;

    started.current = true;
    track(TRACKING_EVENTS.DEPOSIT_WALLET_CONNECTION_STARTED, { deposit_method: 'wallet' });

    void connect({
      client,
      showThirdwebBranding: false,
      size: 'compact',
      wallets: thirdwebWallets,
      theme: thirdwebTheme,
    })
      .then(wallet => {
        if (!wallet) {
          setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE);
          return;
        }

        track(TRACKING_EVENTS.DEPOSIT_WALLET_CONNECTION_SUCCESS, {
          wallet_type: wallet.id,
          deposit_method: 'wallet',
        });
        setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
      })
      .catch(error => {
        console.error(error);
        track(TRACKING_EVENTS.DEPOSIT_WALLET_CONNECTION_FAILED, {
          error: String(error),
          deposit_method: 'wallet',
        });
        setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE);
      })
      .finally(cleanupThirdwebStyles);
  }, [activeAccount?.address, connect, setModal]);

  return (
    <View className="flex-1 items-center justify-center gap-y-3 py-12">
      <ActivityIndicator color="#94F27F" size="large" />
      <Text className="text-sm text-white/70">Opening wallet connection…</Text>
    </View>
  );
};

export default DepositWalletConnector;
