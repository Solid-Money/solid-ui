import React from 'react';

import { BuyCryptoFlowContent } from '@/components/BuyCrypto/Transfi/BuyCryptoFlow';
import { DEPOSIT_MODAL } from '@/constants/modals';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/BuyCrypto/OnramperWidget/OnramperWidget', () => ({
  OnramperWidget: 'OnramperWidget',
}));
jest.mock('@/components/BuyCrypto/Transfi/BuyCryptoNavigation', () => ({
  BuyCryptoNavigationProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/BuyCrypto/Transfi/TransfiAmount', () => ({ TransfiAmount: 'Screen' }));
jest.mock('@/components/BuyCrypto/Transfi/TransfiCurrencySelector', () => ({
  TransfiCurrencySelector: 'Screen',
}));
jest.mock('@/components/BuyCrypto/Transfi/TransfiError', () => ({ TransfiError: 'Screen' }));
jest.mock('@/components/BuyCrypto/Transfi/TransfiKycConsent', () => ({
  TransfiKycConsent: 'Screen',
}));
jest.mock('@/components/BuyCrypto/Transfi/TransfiKycPending', () => ({
  TransfiKycPending: 'Screen',
}));
jest.mock('@/components/BuyCrypto/Transfi/TransfiOrderStatus', () => ({
  TransfiOrderStatus: 'Screen',
}));
jest.mock('@/components/BuyCrypto/Transfi/TransfiPayment', () => ({ TransfiPayment: 'Screen' }));
jest.mock('@/components/BuyCrypto/Transfi/TransfiPaymentMethodSelector', () => ({
  TransfiPaymentMethodSelector: 'Screen',
}));
jest.mock('@/components/BuyCrypto/Transfi/TransfiProfileForm', () => ({
  TransfiProfileForm: 'Screen',
}));

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

// Only the card funding modals embed this content, so the widget it opens must
// fund the card — a wallet URL here would deliver the purchase to the Safe.
it('opens the Onramper widget delivering to the card', () => {
  let root: any;
  act(() => {
    root = create(
      <BuyCryptoFlowContent modal={DEPOSIT_MODAL.OPEN_ONRAMPER_WIDGET} navigate={jest.fn()} />,
    );
  });

  expect(root.root.findByType('OnramperWidget').props.destination).toBe('card');
  act(() => root.unmount());
});
