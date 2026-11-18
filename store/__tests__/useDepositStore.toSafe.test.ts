/// <reference types="jest" />

import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDepositStore } from '@/store/useDepositStore';

// MMKV is a native module — back the persisted store with plain memory here.
const mockMemory = new Map<string, string>();
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({
    setItem: (key: string, value: string) => mockMemory.set(key, value),
    getItem: (key: string) => mockMemory.get(key) ?? null,
    removeItem: (key: string) => mockMemory.delete(key),
  }),
}));

// `toSafe` gives a Wirex cardholder the Safe's address instead of the card's.
// It belongs to the one open of the modal that set it (the AI API's "Add funds").
describe('walletDeposit.toSafe', () => {
  const openForAiApi = () => {
    const store = useDepositStore.getState();
    store.setWalletDeposit({ symbol: 'USDC', chainId: 8453, toSafe: true });
    store.setModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
  };

  afterEach(() => {
    useDepositStore.getState().resetDepositFlow();
  });

  it('holds while the modal is open', () => {
    openForAiApi();
    useDepositStore.getState().setWalletDeposit({ isChangingToken: false });

    expect(useDepositStore.getState().walletDeposit.toSafe).toBe(true);
  });

  // The modal's unmount cleanup closes it without resetting the flow. A flag
  // left behind would follow the user into an ordinary deposit later.
  it('clears when the modal closes without a reset', () => {
    openForAiApi();
    useDepositStore.getState().setModal(DEPOSIT_MODAL.CLOSE);

    expect(useDepositStore.getState().walletDeposit.toSafe).toBe(false);
  });

  it('leaves the rest of the selection to the reset', () => {
    openForAiApi();
    useDepositStore.getState().setModal(DEPOSIT_MODAL.CLOSE);

    expect(useDepositStore.getState().walletDeposit).toMatchObject({
      symbol: 'USDC',
      chainId: 8453,
    });
  });

  it('clears when the flow resets', () => {
    openForAiApi();
    useDepositStore.getState().resetDepositFlow();

    expect(useDepositStore.getState().walletDeposit.toSafe).toBeUndefined();
  });
});
