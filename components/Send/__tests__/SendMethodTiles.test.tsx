import React from 'react';

import { SendMethodTiles } from '@/components/Send/SendMethodTiles';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/hooks/useFeatureAccess', () => ({
  useHasFeature: (feature: string) => feature === 'cashout' && mockGate.hasCashout,
}));
jest.mock('@/hooks/useTransfiCountryAvailability', () => ({
  useTransfiCountryAvailability: () => ({
    isAvailable: mockGate.isCountryServed,
    isResolving: false,
  }),
}));
jest.mock('@/hooks/useCashout', () => ({
  useCashoutEntry: () => ({ startCashout: jest.fn(), isChecking: false }),
}));
jest.mock('@/store/useCashoutStore', () => ({
  useCashoutStore: (selector: (state: any) => unknown) => selector({ reset: jest.fn() }),
}));
jest.mock('@/store/useSendStore', () => ({
  useSendStore: (selector: (state: any) => unknown) => selector({ setModal: jest.fn() }),
}));

const mockGate = { hasCashout: true, isCountryServed: true };

/** The method tiles on screen, by title, with whether each can be pressed. */
const tiles = () => {
  let root: any;
  act(() => {
    root = create(<SendMethodTiles />);
  });
  const shown = root.root
    .findAll(
      (node: any) => typeof node.type === 'string' && node.props.accessibilityRole === 'button',
    )
    .map((node: any) => ({
      title: node.props.accessibilityLabel.split('. ')[0],
      disabled: !!node.props.accessibilityState?.disabled,
    }));
  act(() => root.unmount());
  return shown;
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockGate.hasCashout = true;
  mockGate.isCountryServed = true;
});

it('offers Local payout to a whitelisted user in a country TransFi serves', () => {
  expect(tiles()).toEqual([
    { title: 'Crypto', disabled: false },
    { title: 'Local payout', disabled: false },
  ]);
});

it('leaves Local payout out for a user who is not on the whitelist', () => {
  mockGate.hasCashout = false;
  expect(tiles()).toEqual([{ title: 'Crypto', disabled: false }]);
});

it('greys Local payout out for a whitelisted user TransFi does not serve', () => {
  mockGate.isCountryServed = false;
  expect(tiles()).toEqual([
    { title: 'Crypto', disabled: false },
    { title: 'Local payout', disabled: true },
  ]);
});
