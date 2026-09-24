import React from 'react';

import CardActionsRow from '@/components/Card/NewCardDetails/CardActionsRow';
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
jest.mock('@/components/DepositOption/DepositOptionModal', () => 'DepositOptionModal');
jest.mock('@/components/Card/CardDirectDepositModal', () => 'CardDirectDepositModal');
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));

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
});

// A Wirex card holds no balance of its own, so funding the wallet is funding the
// card — they get the wallet deposit flow, not a card-funding one.
test('sends Wirex Add funds to the wallet deposit flow', () => {
  const tree = render();

  expect(tree.root.findAllByType('DepositOptionModal')).toHaveLength(1);
  expect(tree.root.findAllByType('CardDirectDepositModal')).toHaveLength(0);

  act(() => tree.unmount());
});

// A Rain card is prefunded and separate from the Safe, so it keeps "Fund your
// card" — the wallet flow would put the money somewhere it cannot be spent from.
test('keeps Rain Add funds on the card funding flow', () => {
  mockProvider = CardProvider.RAIN;
  const tree = render();

  expect(tree.root.findAllByType('DepositOptionModal')).toHaveLength(0);
  expect(tree.root.findAllByType('CardDirectDepositModal')).toHaveLength(1);

  act(() => tree.unmount());
});
