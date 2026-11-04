import { useCallback, useEffect, useRef } from 'react';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { RhinoDepositSelection } from '@/lib/rhinoDeposit';

/**
 * "Address viewed" once per address shown, and the handler for "address
 * copied", for whichever screen shows a rhino.fi address.
 */
export const useRhinoAddressAnalytics = (
  selection: RhinoDepositSelection | undefined,
  depositAddress: string | undefined,
) => {
  const trackedAddressRef = useRef<string | undefined>(undefined);
  const chain = selection?.chain;
  const tokenSymbol = selection?.tokenSymbol;
  const destinationType = selection?.destinationType;

  useEffect(() => {
    if (!depositAddress || !chain || trackedAddressRef.current === `${chain}:${depositAddress}`) {
      return;
    }
    trackedAddressRef.current = `${chain}:${depositAddress}`;
    track(TRACKING_EVENTS.DEPOSIT_RHINO_ADDRESS_VIEWED, {
      deposit_method: 'rhino_deposit_address',
      rhino_chain: chain,
      selected_token: tokenSymbol,
      destination_type: destinationType,
    });
  }, [chain, depositAddress, destinationType, tokenSymbol]);

  return useCallback(() => {
    track(TRACKING_EVENTS.DEPOSIT_RHINO_ADDRESS_COPIED, {
      deposit_method: 'rhino_deposit_address',
      rhino_chain: chain,
      selected_token: tokenSymbol,
      destination_type: destinationType,
    });
  }, [chain, destinationType, tokenSymbol]);
};
