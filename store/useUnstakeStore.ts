import { create } from 'zustand';

import { UNSTAKE_MODAL } from '@/constants/modals';
import { VaultKey } from '@/constants/withdraw';
import { TokenBalance, TransactionStatusModal, UnstakeModal } from '@/lib/types';

interface UnstakeState {
  currentModal: UnstakeModal;
  previousModal: UnstakeModal;
  transaction: TransactionStatusModal;
  selectedNetwork?: any;
  selectedToken: TokenBalance | null;
  /** Vault chosen on the vault selection screen (soUSD / soFUSE / soETH). */
  selectedVault: VaultKey | null;
  setModal: (modal: UnstakeModal) => void;
  setTransaction: (transaction: TransactionStatusModal) => void;
  setSelectedNetwork: (network: any) => void;
  setSelectedToken: (token: TokenBalance | null) => void;
  setSelectedVault: (vault: VaultKey | null) => void;
}

export const useUnstakeStore = create<UnstakeState>()((set, get) => ({
  currentModal: UNSTAKE_MODAL.CLOSE,
  previousModal: UNSTAKE_MODAL.CLOSE,
  transaction: {},
  selectedNetwork: undefined,
  selectedToken: null,
  selectedVault: null,

  setModal: modal =>
    set({
      previousModal: get().currentModal,
      currentModal: modal,
    }),
  setTransaction: transaction => set({ transaction }),
  setSelectedNetwork: network => set({ selectedNetwork: network }),
  setSelectedToken: token => set({ selectedToken: token }),
  setSelectedVault: vault => set({ selectedVault: vault }),
}));
