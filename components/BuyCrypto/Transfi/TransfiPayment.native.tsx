import { useCallback, useEffect, useRef } from 'react';
import { openBrowserAsync } from 'expo-web-browser';

import {
  TransfiPaymentHandoff,
  TransfiPaymentUnavailable,
} from '@/components/BuyCrypto/Transfi/TransfiPaymentHandoff';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDepositStore } from '@/store/useDepositStore';
import { useTransfiStore } from '@/store/useTransfiStore';

/**
 * Native: open TransFi's hosted payment page in the system browser
 * (SFSafariViewController / Custom Tabs) instead of a WebView. Payment pages
 * depend on cookies, redirects and provider apps that a WebView handles poorly,
 * and the system browser shows the user a verifiable URL.
 */
export const TransfiPayment = () => {
  const setModal = useDepositStore(state => state.setModal);
  const payUrl = useTransfiStore(state => state.payUrl);
  const openedRef = useRef(false);

  const open = useCallback(async () => {
    if (!payUrl) return;
    try {
      await openBrowserAsync(payUrl);
      // Resolves when the user dismisses the browser — by then they have either
      // paid or backed out, and the status screen resolves which.
      setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_STATUS);
    } catch (error) {
      // Leave the user on this screen so they can retry via the button.
      console.error('Failed to open the TransFi payment page:', error);
    }
  }, [payUrl, setModal]);

  useEffect(() => {
    if (!payUrl || openedRef.current) return;
    openedRef.current = true;
    void open();
  }, [payUrl, open]);

  if (!payUrl) return <TransfiPaymentUnavailable />;

  return <TransfiPaymentHandoff onOpen={() => void open()} />;
};

export default TransfiPayment;
