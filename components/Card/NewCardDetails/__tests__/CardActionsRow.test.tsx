import React from 'react';

import CardActionsRow from '@/components/Card/NewCardDetails/CardActionsRow';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { CardProvider } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let mockProvider = CardProvider.WIREX;

jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: mockProvider }),
}));
jest.mock('@/hooks/useWirexThreeDs', () => ({
  useWirexThreeDs: () => ({ requests: [] }),
}));
jest.mock('@/lib/assets', () => ({ getAsset: (asset: string) => asset }));
jest.mock('@/components/Card/WirexCardFundModal', () => 'WirexCardFundModal');
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));

// The store reaches MMKV, which has no native module under jest; the row only
// ever calls setModal on it.
const mockSetCardDepositModal = jest.fn();
jest.mock('@/store/useCardDepositStore', () => ({
  useCardDepositStore: (selector: (state: unknown) => unknown) =>
    selector({ setModal: mockSetCardDepositModal }),
}));

const render = () => {
  let tree: any;
  act(() => {
    tree = create(
      <CardActionsRow
        isCardFrozen={false}
        canToggleFreeze={true}
        isFreezing={false}
        onFreezeToggle={jest.fn()}
        onManagePress={jest.fn()}
        canAddFunds
      />,
    );
  });
  return tree;
};

afterEach(() => {
  mockProvider = CardProvider.WIREX;
  mockSetCardDepositModal.mockClear();
});

const pressAddFunds = (tree: any) => {
  const button = tree.root
    .findAll((node: any) => node.props?.accessibilityLabel === 'Add funds')
    .find((node: any) => typeof node.props?.onPress === 'function');
  act(() => button.props.onPress());
};

test('opens Wirex Add funds in the card funding popup instead of a route', () => {
  const tree = render();

  expect(tree.root.findAllByType('WirexCardFundModal')).toHaveLength(1);
  expect(mockSetCardDepositModal).not.toHaveBeenCalled();

  act(() => tree.unmount());
});

// Rain cardholders stay on the older deposit screens, which the global
// CardDepositModalProvider renders — so the row opens them through the store
// rather than mounting a modal of its own.
test('sends Rain Add funds to the older card deposit screens', () => {
  mockProvider = CardProvider.RAIN;
  const tree = render();

  expect(tree.root.findAllByType('WirexCardFundModal')).toHaveLength(0);

  pressAddFunds(tree);
  expect(mockSetCardDepositModal).toHaveBeenCalledWith(CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM);

  act(() => tree.unmount());
});
