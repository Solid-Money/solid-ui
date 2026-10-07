import React from 'react';

import DepositUsdOptions, { getUsdMethodChips } from '@/components/DepositOption/DepositUsdOptions';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { CardProvider } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('lucide-react-native', () => ({
  Building2: 'Building2',
  CreditCard: 'CreditCard',
  Zap: 'Zap',
}));
jest.mock('@/components/Card/CardFund/CardFundGroup', () => 'CardFundGroup');
jest.mock('@/components/Card/CardFund/CardFundRow', () => 'CardFundRow');
jest.mock(
  '@/components/DepositOption/VirtualAccountDetails/VirtualAccountApplyDialog',
  () => 'VirtualAccountApplyDialog',
);
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: mockCard.provider, isLoading: false }),
}));
jest.mock('@/hooks/useFeatureAccess', () => ({
  useHasFeature: (feature: string) => mockFeatures[feature] === true,
}));
jest.mock('@/hooks/useOrchestra', () => ({
  useIsCashAppAvailable: () => mockCashApp.isAvailable,
}));
jest.mock('@/hooks/useVirtualAccountEntry', () => ({
  useVirtualAccountEntry: () => ({
    open: mockOpenVirtualAccount,
    isApplyOpen: false,
    closeApply: jest.fn(),
    provider: mockVirtualAccount.provider,
  }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockDeposit),
}));
jest.mock('@/store/useOrchestraStore', () => ({
  useOrchestraStore: (selector: (state: any) => unknown) => selector({ reset: jest.fn() }),
}));

const mockFeatures: Record<string, boolean> = {};
const mockCashApp = { isAvailable: false };
const mockCard: { provider: CardProvider | null } = { provider: null };
const mockVirtualAccount: { provider: 'rain' | 'wirex' | 'loading' } = { provider: 'rain' };
const mockOpenVirtualAccount = jest.fn();
const mockDeposit = { setModal: jest.fn() };

const render = () => {
  let root: any;
  act(() => {
    root = create(<DepositUsdOptions />);
  });
  return root;
};

const rowsOf = (root: any) => root.root.findAllByType('CardFundRow');
const titlesOf = (root: any) => rowsOf(root).map((row: any) => row.props.title);

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockCashApp.isAvailable = false;
  mockCard.provider = null;
  mockVirtualAccount.provider = 'rain';
  mockFeatures.onramper = true;
});

it('offers the card beside the bank rail where Cash App is not available', () => {
  const root = render();
  expect(titlesOf(root)).toEqual(['Wire transfer, ACH', 'Credit card']);
  act(() => root.unmount());
});

it('adds Cash App after them where it is available', () => {
  mockCashApp.isAvailable = true;
  const root = render();
  expect(titlesOf(root)).toEqual(['Wire transfer, ACH', 'Credit card', 'Cash App']);
  act(() => root.unmount());
});

it('opens the Onramper widget from the card row', () => {
  const root = render();
  const card = rowsOf(root).find((row: any) => row.props.title === 'Credit card');
  expect(card.props.subtitle).toBe('Pay with Google/Apple Pay or a card');
  expect(card.props.icon.props.children.type).toBe('CreditCard');
  act(() => card.props.onPress());
  expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_ONRAMPER_WIDGET);
  act(() => root.unmount());
});

it('still opens the virtual account from the bank rail', () => {
  const root = render();
  act(() => rowsOf(root)[0].props.onPress());
  expect(mockOpenVirtualAccount).toHaveBeenCalledTimes(1);
  expect(mockDeposit.setModal).not.toHaveBeenCalled();
  act(() => root.unmount());
});

it('keeps the bank rail for a Rain-issued account', () => {
  mockVirtualAccount.provider = 'rain';
  const root = render();
  expect(titlesOf(root)).toEqual(['Wire transfer, ACH', 'Credit card']);
  act(() => root.unmount());
});

it('keeps the bank rail for a WIREX CARDHOLDER, who is routed to a Rain account', () => {
  // The regression this guards: the rail used to be keyed on the card, so a
  // Wirex cardholder was shown no USD bank option at all — even though Wirex
  // has not launched its virtual account and they are routed to a Rain one,
  // which does support wire and ACH.
  mockCard.provider = CardProvider.WIREX;
  mockVirtualAccount.provider = 'rain';
  mockCashApp.isAvailable = true;
  const root = render();
  expect(titlesOf(root)).toEqual(['Wire transfer, ACH', 'Credit card', 'Cash App']);
  act(() => root.unmount());
});

it('hides the bank rail from a Wirex-ISSUED account, which supports no wire', () => {
  mockVirtualAccount.provider = 'wirex';
  mockCashApp.isAvailable = true;
  const root = render();
  expect(titlesOf(root)).toEqual(['Credit card', 'Cash App']);
  expect(mockOpenVirtualAccount).not.toHaveBeenCalled();
  act(() => root.unmount());
});

it('keeps the rail while the provider is still loading, so it does not pop in', () => {
  mockVirtualAccount.provider = 'loading';
  const root = render();
  expect(titlesOf(root)).toContain('Wire transfer, ACH');
  act(() => root.unmount());
});

it('drops the ACH and Wire chips where the bank rail is hidden', () => {
  expect(getUsdMethodChips({ hasCreditCard: true, hasCashApp: true })).toEqual([
    'ACH',
    'Wire',
    'Credit card',
    'Cash App',
  ]);
  expect(getUsdMethodChips({ hasCreditCard: true, hasCashApp: false })).toEqual([
    'ACH',
    'Wire',
    'Credit card',
  ]);
  expect(
    getUsdMethodChips({ hasBankTransfer: false, hasCreditCard: true, hasCashApp: true }),
  ).toEqual(['Credit card', 'Cash App']);
  expect(
    getUsdMethodChips({ hasBankTransfer: false, hasCreditCard: true, hasCashApp: false }),
  ).toEqual(['Credit card']);
});

describe('for a user who is not on the feature whitelist', () => {
  beforeEach(() => {
    mockFeatures.onramper = false;
  });

  it('hides the card row', () => {
    mockCashApp.isAvailable = true;
    const root = render();
    expect(titlesOf(root)).toEqual(['Wire transfer, ACH', 'Cash App']);
    act(() => root.unmount());
  });

  it('drops the Credit card chip, leaving none where USD has no other method', () => {
    expect(getUsdMethodChips({ hasCreditCard: false, hasCashApp: true })).toEqual([
      'ACH',
      'Wire',
      'Cash App',
    ]);
    expect(getUsdMethodChips({ hasCreditCard: false, hasCashApp: false })).toEqual(['ACH', 'Wire']);
    expect(
      getUsdMethodChips({ hasBankTransfer: false, hasCreditCard: false, hasCashApp: false }),
    ).toEqual([]);
  });
});
