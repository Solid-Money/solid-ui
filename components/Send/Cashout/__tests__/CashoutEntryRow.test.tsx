import React from 'react';

import { CashoutEntryRow } from '@/components/Send/Cashout/CashoutEntryRow';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('lucide-react-native', () => ({ ChevronRight: 'ChevronRight', Landmark: 'Landmark' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/hooks/useFeatureAccess', () => ({
  useHasFeature: (feature: string) => feature === 'cashout' && mockGate.hasCashout,
}));
jest.mock('@/hooks/useTransfiCountryAvailability', () => ({
  useTransfiCountryAvailability: () => ({ isAvailable: mockGate.isCountryServed }),
}));
jest.mock('@/hooks/useCashout', () => ({
  useCashoutEntry: () => ({ startCashout: jest.fn(), isChecking: false }),
}));
jest.mock('@/store/useCashoutStore', () => ({
  useCashoutStore: (selector: (state: any) => unknown) => selector({ reset: jest.fn() }),
}));

const mockGate = { hasCashout: true, isCountryServed: true };

const isShown = () => {
  let root: any;
  act(() => {
    root = create(<CashoutEntryRow />);
  });
  const shown = root.toJSON() !== null;
  act(() => root.unmount());
  return shown;
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockGate.hasCashout = true;
  mockGate.isCountryServed = true;
});

it('shows the row to a whitelisted user in a country TransFi serves', () => {
  expect(isShown()).toBe(true);
});

it('hides it from a user who is not on the whitelist', () => {
  mockGate.hasCashout = false;
  expect(isShown()).toBe(false);
});

it('hides it where TransFi does not serve the country, whitelist or not', () => {
  mockGate.isCountryServed = false;
  expect(isShown()).toBe(false);
});
