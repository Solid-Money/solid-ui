import React, { useCallback, useEffect, useState } from 'react';
import { useActiveAccount, useConnectModal } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';

import { client } from '@/lib/thirdweb';
import CardDepositExternalForm from './CardDepositExternalForm';

export default function CardDepositExternal() {
  const { connect } = useConnectModal();
  const account = useActiveAccount();
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = useCallback(async () => {
    try {
      setIsConnecting(true);
      await connect({
        client,
        showThirdwebBranding: false,
        size: 'compact',
        wallets: [createWallet('io.rabby'), createWallet('io.metamask')],
      });
    } finally {
      setIsConnecting(false);
    }
  }, [connect]);

  useEffect(() => {
    if (!account && !isConnecting) {
      connectWallet();
    }
  }, [account, isConnecting, connectWallet]);

  // After wallet is connected, show external form with ConnectedWalletDropdown
  return <CardDepositExternalForm />;
}
