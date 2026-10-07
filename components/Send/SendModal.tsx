import React from 'react';

import SlotTrigger from '@/components/SlotTrigger';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCrossChainSendConfig } from '@/hooks/useCrossChainSendConfig';
import { SendOptionProps } from '@/hooks/useSendOption';
import { track } from '@/lib/analytics';
import { SendModal as SendModalType, TokenBalance } from '@/lib/types';
import { isCrossChainSendToken } from '@/lib/utils/cross-chain-send';
import { useSendStore } from '@/store/useSendStore';

import SendTrigger from './SendTrigger';

interface SendModalProps extends Omit<SendOptionProps, 'trigger'> {
  token?: TokenBalance;
  trigger?: React.ReactNode;
  modal?: SendModalType;
}

/**
 * SendModal - now a thin wrapper around trigger components.
 *
 * The actual modal is rendered by SendModalProvider at the app root.
 * This component only renders the trigger button to open the modal.
 *
 * For headless usage (no trigger or token), this component renders nothing
 * since the global SendModalProvider handles the modal state.
 */
const SendModal = ({ token, trigger, modal }: SendModalProps) => {
  const setModal = useSendStore(state => state.setModal);
  const setSelectedToken = useSendStore(state => state.setSelectedToken);
  const setCurrentTokenAddress = useSendStore(state => state.setCurrentTokenAddress);
  const setIsCrossChain = useSendStore(state => state.setIsCrossChain);

  // Only the two bridgeable Fuse stablecoins can take the cross-chain flow, and
  // only once the backend has enabled it for this user — so the config is
  // fetched just for them, never for a plain token's trigger.
  const canBridge = !!token && !!trigger && isCrossChainSendToken(token);
  const { config } = useCrossChainSendConfig({ enabled: canBridge });

  // If only a token is provided, use the specialized SendTrigger
  if (token && !trigger) {
    return <SendTrigger token={token} />;
  }

  // Headless usage - the global SendModalProvider handles the modal
  if (!trigger) {
    return null;
  }

  const handlePress = () => {
    if (token) {
      setSelectedToken(token);
      setCurrentTokenAddress(token.contractAddress);
      track(TRACKING_EVENTS.SEND_MODAL_OPENED, {
        token_symbol: token.contractTickerSymbol,
        token_address: token.contractAddress,
        chain_id: token.chainId,
        cross_chain: canBridge && !!config?.enabled,
      });
      if (canBridge && config?.enabled) {
        // Same recipient screen as a regular send (contacts, recents, paste,
        // QR); picking a recipient then goes to the network step.
        setIsCrossChain(true);
        useSendStore.getState().setCrossChainEntry('recipient');
        setModal(SEND_MODAL.OPEN_SEND_SEARCH);
        return;
      }
    }
    setModal(modal || SEND_MODAL.OPEN_SEND_SEARCH);
  };

  return <SlotTrigger onPress={handlePress}>{trigger}</SlotTrigger>;
};

export default SendModal;
