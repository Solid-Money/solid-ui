import { useCallback } from 'react';

import { OrchestraNavigate } from '@/components/Orchestra/OrchestraNavigation';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCashAppDepositAvailability } from '@/hooks/useCashAppDepositAvailability';
import { useOrchestraConfig } from '@/hooks/useOrchestra';
import { track } from '@/lib/analytics';
import { useOrchestraStore } from '@/store/useOrchestraStore';

/**
 * Opening the Cash App onramp from a card funding modal.
 *
 * Shared by the three of them so the availability gate and the destination are
 * set the same way in each — a modal that forgot `setDestination('card')`
 * would quietly fund the wallet from a screen titled "Fund your card".
 *
 * `isAvailable` is the server's verdict, the same one the wallet flow gates
 * on: region or allowlist. Hosts pass `onCashAppPress` only when it is true,
 * which is how the row stays hidden rather than disabled.
 */
export const useOrchestraCardEntry = (navigate: OrchestraNavigate) => {
  const reset = useOrchestraStore(state => state.reset);
  const setDestination = useOrchestraStore(state => state.setDestination);

  const { countryCode, isResolving } = useCashAppDepositAvailability();
  const { data: config } = useOrchestraConfig(countryCode, !isResolving);

  const openCashApp = useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
      deposit_method: 'buy_crypto',
      provider: 'orchestra',
      currency: 'USD',
      destination: 'card',
    });
    // A previous order's invoice and read token would otherwise still be in
    // the store, and the status screen would track it instead of the new one.
    reset();
    setDestination('card');
    navigate(DEPOSIT_MODAL.OPEN_ORCHESTRA_AMOUNT);
  }, [navigate, reset, setDestination]);

  return { openCashApp, isAvailable: config?.isAvailable === true };
};

export default useOrchestraCardEntry;
