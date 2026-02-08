import { Wallet } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useActiveAccount, useConnectModal } from 'thirdweb/react';
import { useShallow } from 'zustand/react/shallow';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { cleanupThirdwebStyles, client, thirdwebTheme, thirdwebWallets } from '@/lib/thirdweb';
import { DepositMethod } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import useUser from '@/hooks/useUser';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { useDimension } from './useDimension';

import HomeQR from '@/assets/images/home-qr';

const useDepositExternalWalletOptions = () => {
  const activeAccount = useActiveAccount();
  const { connect } = useConnectModal();
  const setModal = useDepositStore(state => state.setModal);
  const setDepositFromSolid = useDepositStore(state => state.setDepositFromSolid);
  const { isScreenMedium } = useDimension();
  const { user } = useUser();
  const { vault } = useVaultDepositConfig();
  const address = activeAccount?.address;

  const [isWalletOpen, setIsWalletOpen] = useState(false);

  const handleDepositDirectly = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'deposit_directly',
    });
    setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY);
  }, [setModal]);

  const openWallet = useCallback(async () => {
    try {
      if (isWalletOpen) return;

      if (address) {
        track(TRACKING_EVENTS.DEPOSIT_WALLET_ALREADY_CONNECTED, {
          wallet_address: address,
          deposit_method: 'wallet',
        });
        setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
        return;
      }

      track(TRACKING_EVENTS.DEPOSIT_WALLET_CONNECTION_STARTED, {
        deposit_method: 'wallet',
      });

      setIsWalletOpen(true);
      const wallet = await connect({
        client,
        showThirdwebBranding: false,
        size: 'compact',
        wallets: thirdwebWallets,
        theme: thirdwebTheme,
      });

      if (wallet) {
        track(TRACKING_EVENTS.DEPOSIT_WALLET_CONNECTION_SUCCESS, {
          wallet_type: wallet.id,
          deposit_method: 'wallet',
        });
        setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
      }
    } catch (error) {
      console.error(error);
      track(TRACKING_EVENTS.DEPOSIT_WALLET_CONNECTION_FAILED, {
        error: String(error),
        deposit_method: 'wallet',
      });
    } finally {
      setIsWalletOpen(false);
      cleanupThirdwebStyles();
    }
  }, [isWalletOpen, connect, address, setModal]);

  const handleSolidWallet = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'wallet',
      deposit_type: 'solid_wallet',
    });
    setDepositFromSolid(true);
    setModal(DEPOSIT_MODAL.OPEN_NETWORKS);
  }, [setDepositFromSolid, setModal]);

  const externalWalletOptions = useMemo(() => {
    const base = [
      {
        text: 'Send from your crypto wallet',
        subtitle: 'Add supported assets from supported\nnetworks directly to your account',
        icon: <Wallet color="white" size={24} strokeWidth={1} />,
        onPress: openWallet,
        isLoading: isWalletOpen,
        isEnabled: isScreenMedium,
        method: 'wallet' as DepositMethod,
      },
      {
        text: 'Share your deposit address',
        subtitle: 'Send USDC to your solid deposit\naddress from any supported network',
        icon: <HomeQR />,
        onPress: handleDepositDirectly,
        method: 'deposit_directly' as DepositMethod,
      },
    ];
    if (vault?.name === 'FUSE') {
      return [
        {
          text: 'Send from your Solid wallet',
          subtitle: 'Use supported assets from your\nSolid account on Fuse',
          icon: <Wallet color="white" size={24} strokeWidth={1} />,
          onPress: handleSolidWallet,
          isLoading: false,
          isEnabled: !!user?.safeAddress,
          method: 'wallet' as DepositMethod,
        },
        ...base,
      ];
    }
    return base;
  }, [
    openWallet,
    isWalletOpen,
    isScreenMedium,
    handleDepositDirectly,
    handleSolidWallet,
    vault?.name,
    user?.safeAddress,
  ]);

  return { externalWalletOptions };
};

export default useDepositExternalWalletOptions;
