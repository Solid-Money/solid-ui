import { useEffect } from 'react';
import { useActiveAccount, useActiveWallet, useActiveWalletConnectionStatus } from 'thirdweb/react';

import { useDepositStore } from '@/store/useDepositStore';

/**
 * Desktop-only bridge that mirrors the thirdweb external-wallet connection state
 * (address, status, and the account/wallet objects) into useDepositStore. This
 * lets always-mounted consumers (useDepositOption) and the vault-deposit EOA
 * hooks read connection state from the store WITHOUT calling thirdweb hooks —
 * which is what allows the ThirdwebProvider to be mounted on desktop only
 * (external-wallet connect is desktop-only; mobile uses direct deposit / QR).
 *
 * MUST be rendered inside <ThirdwebProvider>, i.e. only when isDesktop. Renders nothing.
 */
export default function ThirdwebConnectionBridge() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const status = useActiveWalletConnectionStatus();
  const setExternalWallet = useDepositStore(state => state.setExternalWallet);

  useEffect(() => {
    setExternalWallet({ address: account?.address, status, account, wallet });
  }, [account, wallet, status, setExternalWallet]);

  return null;
}
