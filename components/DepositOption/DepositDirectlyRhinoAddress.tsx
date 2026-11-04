import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import RhinoDepositAddress from '@/components/DepositOption/RhinoDeposit/RhinoDepositAddress';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { RhinoDepositSelection } from '@/lib/rhinoDeposit';
import { useDepositStore } from '@/store/useDepositStore';

/**
 * The savings "Deposit directly" address step for a chain rhino.fi serves: the
 * user's rhino.fi address into soUSD, in place of a direct-deposit session's.
 * Its network row goes back to the network list; once the payout lands in
 * savings, the user is handed to its activity, as on "Deposit to savings".
 */
const DepositDirectlyRhinoAddress = ({ selection }: { selection: RhinoDepositSelection }) => {
  const router = useRouter();
  const { setModal, resetDepositFlow } = useDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      resetDepositFlow: state.resetDepositFlow,
    })),
  );

  const handleDetected = useCallback(
    (clientTxId: string) => {
      setModal(DEPOSIT_MODAL.CLOSE);
      resetDepositFlow();
      router.push(`/activity/${clientTxId}`);
    },
    [resetDepositFlow, router, setModal],
  );

  return (
    <RhinoDepositAddress
      selection={selection}
      onChangeNetwork={() => setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY)}
      onDepositDetected={handleDetected}
    />
  );
};

export default DepositDirectlyRhinoAddress;
