import { useCallback, useEffect, useRef, useState } from 'react';

import {
  TransfiPaymentHandoff,
  TransfiPaymentUnavailable,
} from '@/components/BuyCrypto/Transfi/TransfiPaymentHandoff';
import { useTransfiStore } from '@/store/useTransfiStore';

/**
 * Web: hand off to TransFi's hosted payment page in a new tab rather than
 * framing it. The page runs its own 3DS/redirect flows and provider widgets,
 * which an iframe can break, and a real tab gives the user a visible, trusted
 * URL for entering payment details.
 */
export const TransfiPayment = () => {
  const payUrl = useTransfiStore(state => state.payUrl);
  const [blocked, setBlocked] = useState(false);
  const openedRef = useRef(false);

  const open = useCallback(() => {
    if (!payUrl) return;
    const win = window.open(payUrl, '_blank', 'noopener,noreferrer');
    // A null handle means a popup blocker stopped it — the user has to trigger
    // the open themselves, so switch the screen to a button-first layout.
    setBlocked(!win);
  }, [payUrl]);

  // Attempt the open once on arrival. This runs outside the click that created
  // the order, so it may be blocked; that path is handled rather than assumed.
  useEffect(() => {
    if (!payUrl || openedRef.current) return;
    openedRef.current = true;
    open();
  }, [payUrl, open]);

  if (!payUrl) return <TransfiPaymentUnavailable />;

  return <TransfiPaymentHandoff onOpen={open} blocked={blocked} />;
};

export default TransfiPayment;
