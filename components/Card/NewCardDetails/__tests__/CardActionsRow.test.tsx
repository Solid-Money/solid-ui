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
jest.mock('@/components/Card/WirexCardFundModal', () => 'WirexCardFundModal');
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

test('opens Wirex Add funds in the card funding popup instead of a route', () => {
  const tree = render();

  expect(tree.root.findAllByType('WirexCardFundModal')).toHaveLength(1);
  expect(tree.root.findAllByType('CardDirectDepositModal')).toHaveLength(0);

  act(() => tree.unmount());
});

test('keeps Rain Add funds in its direct-deposit popup', () => {
  mockProvider = CardProvider.RAIN;
  const tree = render();

  expect(tree.root.findAllByType('WirexCardFundModal')).toHaveLength(0);
  expect(tree.root.findAllByType('CardDirectDepositModal')).toHaveLength(1);

  act(() => tree.unmount());
});
