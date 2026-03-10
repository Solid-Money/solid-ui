import { create } from 'zustand';

import { SPIN_WIN_MODAL } from '@/constants/modals';

type SpinWinModal = (typeof SPIN_WIN_MODAL)[keyof typeof SPIN_WIN_MODAL];

interface SpinWinModalState {
  currentModal: SpinWinModal;
  previousModal: SpinWinModal;
  resultPoints?: number;
  setModal: (modal: SpinWinModal) => void;
  setResultPoints: (points?: number) => void;
  reset: () => void;
}

export const useSpinWinModalStore = create<SpinWinModalState>()((set, get) => ({
  currentModal: SPIN_WIN_MODAL.CLOSE,
  previousModal: SPIN_WIN_MODAL.CLOSE,
  resultPoints: undefined,

  setModal: modal =>
    set({
      previousModal: get().currentModal,
      currentModal: modal,
    }),

  setResultPoints: points =>
    set({
      resultPoints: points,
    }),

  reset: () =>
    set({
      currentModal: SPIN_WIN_MODAL.CLOSE,
      previousModal: SPIN_WIN_MODAL.CLOSE,
      resultPoints: undefined,
    }),
}));
