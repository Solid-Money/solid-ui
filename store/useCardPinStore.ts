import { create } from 'zustand';

import { CARD_PIN_MODAL } from '@/constants/modals';

interface CardPinState {
  currentModal: { name: string; number: number };
  previousModal: { name: string; number: number };
  setModal: (modal: { name: string; number: number }) => void;
}

export const useCardPinStore = create<CardPinState>()((set, get) => ({
  currentModal: CARD_PIN_MODAL.CLOSE,
  previousModal: CARD_PIN_MODAL.CLOSE,
  setModal: modal =>
    set({
      previousModal: get().currentModal,
      currentModal: modal,
    }),
}));
