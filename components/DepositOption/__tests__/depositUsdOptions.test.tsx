import React from 'react';

import DepositUsdOptions, { getUsdMethodChips } from '@/components/DepositOption/DepositUsdOptions';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { CardProvider } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('lucide-react-native', () => ({ Building2: 'Building2', Zap: 'Zap' }));
jest.mock('@/assets/images/apple-pay-circle', () => 'ApplePayCircle');
jest.mock('@/components/Card/CardFund/CardFundGroup', () => 'CardFundGroup');
jest.mock('@/components/Card/CardFund/CardFundRow', () => 'CardFundRow');
jest.mock(
  '@/components/DepositOption/VirtualAccountDetails/VirtualAccountApplyDialog',
  () => 'VirtualAccountApplyDialog',
);
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: mockCard.provider, isLoading: false }),
}));
jest.mock('@/hooks/useOrchestra', () => ({
  useIsCashAppAvailable: () => mockCashApp.isAvailable,
}));
jest.mock('@/hooks/useVirtualAccountEntry', () => ({
  useVirtualAccountEntry: () => ({
    open: mockOpenVirtualAccount,
    isApplyOpen: false,
    closeApply: jest.fn(),
  }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/config', () => ({
  get isDevFeatureEnabled() {
    return mockConfig.isDevFeatureEnabled;
  },
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockDeposit),
}));
jest.mock('@/store/useOrchestraStore', () => ({
  useOrchestraStore: (selector: (state: any) => unknown) => selector({ reset: jest.fn() }),
}));

const mockConfig = { isDevFeatureEnabled: true };
const mockCashApp = { isAvailable: false };
const mockCard: { provider: CardProvider | null } = { provider: null };
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
  mockConfig.isDevFeatureEnabled = true;
});

it('offers Apple Pay beside the bank rail where Cash App is not available', () => {
  const root = render();
  expect(titlesOf(root)).toEqual(['Wire transfer, ACH', 'Apple Pay']);
  act(() => root.unmount());
});

it('adds Cash App between them where it is available', () => {
  mockCashApp.isAvailable = true;
  const root = render();
  expect(titlesOf(root)).toEqual(['Wire transfer, ACH', 'Cash App', 'Apple Pay']);
  act(() => root.unmount());
});

it('opens the Onramper widget from Apple Pay', () => {
  const root = render();
  const applePay = rowsOf(root).find((row: any) => row.props.title === 'Apple Pay');
  act(() => applePay.props.onPress());
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

it('keeps the bank rail for a Rain cardholder', () => {
  mockCard.provider = CardProvider.RAIN;
  const root = render();
  expect(titlesOf(root)).toEqual(['Wire transfer, ACH', 'Apple Pay']);
  act(() => root.unmount());
});

it('hides the bank rail from a Wirex cardholder, who has no wire leg to their card', () => {
  mockCard.provider = CardProvider.WIREX;
  mockCashApp.isAvailable = true;
  const root = render();
  expect(titlesOf(root)).toEqual(['Cash App', 'Apple Pay']);
  expect(mockOpenVirtualAccount).not.toHaveBeenCalled();
  act(() => root.unmount());
});

it('drops the ACH and Wire chips where the bank rail is hidden', () => {
  expect(getUsdMethodChips(true)).toEqual(['ACH', 'Wire', 'Cash App', 'Apple Pay']);
  expect(getUsdMethodChips(false)).toEqual(['ACH', 'Wire', 'Apple Pay']);
  expect(getUsdMethodChips(true, false)).toEqual(['Cash App', 'Apple Pay']);
  expect(getUsdMethodChips(false, false)).toEqual(['Apple Pay']);
});

describe('in production, where Apple Pay is not offered yet', () => {
  beforeEach(() => {
    mockConfig.isDevFeatureEnabled = false;
  });

  it('hides the Apple Pay row', () => {
    mockCashApp.isAvailable = true;
    const root = render();
    expect(titlesOf(root)).toEqual(['Wire transfer, ACH', 'Cash App']);
    act(() => root.unmount());
  });

  it('drops the Apple Pay chip, leaving none where USD has no other method', () => {
    expect(getUsdMethodChips(true)).toEqual(['ACH', 'Wire', 'Cash App']);
    expect(getUsdMethodChips(false)).toEqual(['ACH', 'Wire']);
    expect(getUsdMethodChips(false, false)).toEqual([]);
  });
});
