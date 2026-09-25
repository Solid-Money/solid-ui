import { useState } from 'react';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import { useVirtualAccountProvider } from '@/hooks/useVirtualAccountProvider';
import { track } from '@/lib/analytics';
import { RainApplicationStatus } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

/**
 * Opening the USD virtual account — the ACH/wire rail.
 *
 * Extracted from DepositCashOptions because two screens now reach it: the cash
 * list directly, where Cash App is unavailable, and the USD method chooser,
 * where it is one of two options. Duplicating the provider routing would have
 * been the second copy to drift.
 *
 * A Wirex user has no Rain automation and never will, so the Rain apply pitch is
 * not their next step — their details screen owns activation for both rails.
 * Sending them to the pitch is how they reached a "Verify now" that could only
 * bounce them off the Rain KYC gate.
 */
export const useVirtualAccountEntry = () => {
  const setModal = useDepositStore(state => state.setModal);
  const [isApplyOpen, setIsApplyOpen] = useState(false);

  const { data: cardStatus } = useCardStatus();
  const isRainApproved = cardStatus?.rainApplicationStatus === RainApplicationStatus.APPROVED;
  const { data: existingAutomation } = useOnrampAutomation(isRainApproved);
  const { provider } = useVirtualAccountProvider();

  const open = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'bank_transfer',
      provider,
    });

    if (provider === 'wirex' || existingAutomation) {
      setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
      return;
    }
    setIsApplyOpen(true);
  };

  return {
    open,
    provider,
    isApplyOpen,
    closeApply: () => setIsApplyOpen(false),
  };
};

export default useVirtualAccountEntry;
