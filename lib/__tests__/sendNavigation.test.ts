import { SEND_MODAL } from '@/constants/modals';
import { recipientNextModal, useSendStore } from '@/store/useSendStore';

describe('send recipient navigation', () => {
  beforeEach(() => useSendStore.getState().resetAll());

  it.each([SEND_MODAL.OPEN_SEND_OPTIONS, SEND_MODAL.OPEN_SEND_SEARCH])(
    'remembers $name through recipient selection and saving a contact',
    modal => {
      const state = useSendStore.getState();
      state.setModal(modal);
      state.setModal(SEND_MODAL.OPEN_ADDRESS_BOOK);
      expect(useSendStore.getState().recipientModal).toEqual(modal);
      state.setModal(SEND_MODAL.OPEN_FORM);
      expect(useSendStore.getState().recipientModal).toEqual(modal);
    },
  );

  it('keeps cross-chain recipient routing and token entry separate from the chooser', () => {
    const state = useSendStore.getState();
    state.setEntryModal(SEND_MODAL.OPEN_SEND_SEARCH);
    state.setIsCrossChain(true);
    expect(recipientNextModal()).toEqual(SEND_MODAL.OPEN_CROSS_CHAIN_NETWORK);
    expect(useSendStore.getState().entryModal).toEqual(SEND_MODAL.OPEN_SEND_SEARCH);
    state.resetAll();
    expect(useSendStore.getState().entryModal).toEqual(SEND_MODAL.OPEN_SEND_OPTIONS);
    expect(recipientNextModal()).toEqual(SEND_MODAL.OPEN_FORM);
  });
});
