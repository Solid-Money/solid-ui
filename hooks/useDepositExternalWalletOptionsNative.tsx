import { useCallback, useMemo } from 'react';
import { Wallet } from 'lucide-react-native';

import HomeQR from '@/assets/images/home-qr';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { track } from '@/lib/analytics';
import { DepositMethod } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

const useDepositExternalWalletOptionsNative = () => {
  const setModal = useDepositStore(state => state.setModal);
  const setDepositFromSolid = useDepositStore(state => state.setDepositFromSolid);
  const { user } = useUser();
  const { vault } = useVaultDepositConfig();

  const handleDepositDirectly = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'deposit_directly',
    });

    setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY);
  }, [setModal]);

  const handleSolidWallet = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'wallet',
      deposit_type: 'solid_wallet',
    });

    setDepositFromSolid(true);
    setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
  }, [setDepositFromSolid, setModal]);

  const externalWalletOptions = useMemo(
    () =>
      vault?.name === 'FUSE'
        ? [
            {
              text: 'Send from your Solid wallet',
              subtitle: 'Use supported assets from your\nSolid account on Fuse',
              icon: <Wallet color="white" size={24} strokeWidth={1} />,
              onPress: handleSolidWallet,
              isEnabled: !!user?.safeAddress,
              method: 'wallet' as DepositMethod,
            },
          ]
        : [
            {
              text: 'Share your deposit address',
              subtitle: 'Send USDC to your solid\ndeposit address from any supported\nnetwork',
              icon: <HomeQR />,
              onPress: handleDepositDirectly,
              method: 'deposit_directly' as DepositMethod,
            },
          ],
    [handleDepositDirectly, handleSolidWallet, vault?.name, user?.safeAddress],
  );

  return { externalWalletOptions };
};

export default useDepositExternalWalletOptionsNative;
