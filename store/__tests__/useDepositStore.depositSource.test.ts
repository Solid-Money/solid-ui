/// <reference types="jest" />

import { DEPOSIT_MODAL } from '@/constants/modals';
import { USER } from '@/lib/config';
import { useDepositStore } from '@/store/useDepositStore';

// MMKV is a native module — back the persisted store with plain memory here.
// (jest.mock is hoisted above the import by babel-jest.)
const mockMemory = new Map<string, string>();
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({
    setItem: (key: string, value: string) => mockMemory.set(key, value),
    getItem: (key: string) => mockMemory.get(key) ?? null,
    removeItem: (key: string) => mockMemory.delete(key),
  }),
}));

// The deposit form picks the chain the Solid wallet holds the most on, unless
// the chain is already settled for this open of the flow.
describe('deposit source choice', () => {
  afterEach(() => {
    useDepositStore.getState().resetDepositFlow();
  });

  it('starts unsettled so the form makes its pick', () => {
    expect(useDepositStore.getState().depositSourceChosen).toBe(false);
  });

  it('stays settled while moving between steps of the flow', () => {
    const store = useDepositStore.getState();
    store.setDepositSourceChosen(true);
    store.setModal(DEPOSIT_MODAL.OPEN_TOKEN_SELECTOR);
    store.setModal(DEPOSIT_MODAL.OPEN_FORM);

    expect(useDepositStore.getState().depositSourceChosen).toBe(true);
  });

  // Several screens close the modal without resetting the flow; the next open
  // must still pick from current balances, not keep the last chain.
  it('clears when the modal closes', () => {
    const store = useDepositStore.getState();
    store.setDepositSourceChosen(true);
    store.setModal(DEPOSIT_MODAL.CLOSE);

    expect(useDepositStore.getState().depositSourceChosen).toBe(false);
  });

  it('clears when the flow resets', () => {
    const store = useDepositStore.getState();
    store.setDepositSourceChosen(true);
    store.resetDepositFlow();

    expect(useDepositStore.getState().depositSourceChosen).toBe(false);
  });

  // Persisting it would carry one session's choice into a later open.
  it('is not persisted', () => {
    useDepositStore.getState().setDepositSourceChosen(true);

    expect(mockMemory.get(USER.depositStorageKey)).not.toContain('depositSourceChosen');
  });
});
