import React from 'react';

import SavingsFundDepositAddress from '@/components/Savings/SavingsFund/SavingsFundDepositAddress';
import SavingsFundNetworks from '@/components/Savings/SavingsFund/SavingsFundNetworks';
import SavingsFundOptions from '@/components/Savings/SavingsFund/SavingsFundOptions';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useSavingsFundFlow } from '@/hooks/useSavingsFundFlow';
import { useDepositStore } from '@/store/useDepositStore';

type SavingsFundStep = 'options' | 'networks' | 'address';

/**
 * The savings direct-deposit screens, bound to `useSavingsFundFlow`.
 *
 * The deposit modal renders one component per step without props, so each step
 * mounts this with its own `step` and the shared flow state comes from the store.
 */
const SavingsFundScreen = ({ step }: { step: SavingsFundStep }) => {
  const setModal = useDepositStore(state => state.setModal);
  const {
    selectedToken,
    selectedChainId,
    depositAddress,
    isPreparingSession,
    hasSessionError,
    selectToken,
    selectNetwork,
    retryPrepareSession,
    moveFromWallet,
    depositFromExternalWallet,
    openDetectedDeposit,
  } = useSavingsFundFlow();

  if (step === 'networks') {
    return (
      <SavingsFundNetworks
        symbol={selectedToken}
        onSelect={chainId => selectNetwork(chainId)}
        loadingChainId={isPreparingSession ? selectedChainId : undefined}
      />
    );
  }

  if (step === 'address') {
    return (
      <SavingsFundDepositAddress
        address={depositAddress}
        symbol={selectedToken}
        chainId={selectedChainId ?? 0}
        hasError={hasSessionError}
        onRetry={retryPrepareSession}
        onChangeNetwork={() => setModal(DEPOSIT_MODAL.OPEN_SAVINGS_FUND_NETWORKS)}
        onDepositDetected={openDetectedDeposit}
      />
    );
  }

  return (
    <SavingsFundOptions
      onTokenPress={selectToken}
      onMoveFromWalletPress={moveFromWallet}
      onExternalWalletPress={depositFromExternalWallet}
    />
  );
};

export default SavingsFundScreen;
