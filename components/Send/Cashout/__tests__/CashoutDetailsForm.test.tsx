import React from 'react';
import { ActivityIndicator } from 'react-native';

import { CashoutDetailsForm } from '@/components/Send/Cashout/CashoutDetailsForm';
import { SEND_MODAL } from '@/constants/modals';
import { asTransfiError } from '@/lib/transfiErrors';
import { useCashoutStore } from '@/store/useCashoutStore';

import type { TransfiCashoutPaymentMethod } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('lucide-react-native', () => ({
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  Lock: 'Lock',
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/input', () => ({ __esModule: true, default: 'Input' }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/hooks/useTransfiCashout', () => ({
  useTransfiCashoutPaymentMethods: () => mockState.query,
}));
jest.mock('@/store/useSendStore', () => ({
  useSendStore: (selector: (state: any) => unknown) => selector({ setModal: mockState.setModal }),
}));

const PALMPAY: TransfiCashoutPaymentMethod = {
  paymentCode: 'palmpay',
  paymentType: 'local_wallet',
  type: 'mobile_money',
  fields: [{ key: 'phone', label: 'Phone number', type: 'phone', required: true }],
};

const BANK: TransfiCashoutPaymentMethod = {
  paymentCode: 'ng_bank',
  paymentType: 'bank_transfer',
  type: 'bank',
  fields: [{ key: 'account', label: 'Account number', type: 'number', required: true }],
};

type Query = {
  data?: TransfiCashoutPaymentMethod[];
  isLoading: boolean;
  error: unknown;
  refetch: jest.Mock;
  isFetching: boolean;
};

const mockState: { query: Query; setModal: jest.Mock } = {
  query: { isLoading: false, error: null, refetch: jest.fn(), isFetching: false },
  setModal: jest.fn(),
};

const query = (overrides: Partial<Query>) => {
  mockState.query = {
    data: undefined,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    isFetching: false,
    ...overrides,
  };
};

let mounted: any;

const render = () => {
  act(() => {
    mounted = create(<CashoutDetailsForm />);
  });
  return mounted.root;
};

const texts = (root: any): string[] =>
  root.findAllByType('Text').map((node: any) => [].concat(node.props.children).join(''));

const button = (root: any, label: string) =>
  root.findAllByType('Button').find((node: any) => texts(node).includes(label));

beforeEach(() => {
  mockState.setModal = jest.fn();
  useCashoutStore.setState({
    currency: 'NGN',
    paymentCode: 'palmpay',
    paymentDetails: {},
    fieldErrors: {},
  });
});

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
});

describe('CashoutDetailsForm', () => {
  it('waits while the methods load', () => {
    query({ isLoading: true, isFetching: true });
    const root = render();
    expect(root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(root.findAllByType('Button')).toHaveLength(0);
  });

  it('says when the methods fail to load, and tries again on request', () => {
    const error = new Error('network down');
    query({ error });
    const root = render();

    expect(root.findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(texts(root)).toEqual(
      expect.arrayContaining(['Couldn’t load your payout details', asTransfiError(error).message]),
    );
    const retry = button(root, 'Try again');
    expect(retry.props.disabled).toBe(false);
    act(() => retry.props.onPress());
    expect(mockState.query.refetch).toHaveBeenCalledTimes(1);
  });

  it('holds the retry button while it is trying again', () => {
    query({ error: new Error('network down'), isFetching: true });
    const root = render();
    expect(button(root, 'Trying again…').props.disabled).toBe(true);
  });

  it('sends back to the method step when the chosen method is gone but others remain', () => {
    query({ data: [BANK] });
    const root = render();

    expect(texts(root)).toContain('This way to get paid isn’t available');
    act(() => button(root, 'Choose another').props.onPress());
    expect(mockState.setModal).toHaveBeenCalledWith(SEND_MODAL.OPEN_CASHOUT_METHOD);
  });

  it('sends back to the country list when the currency has no methods left', () => {
    query({ data: [] });
    const root = render();

    act(() => button(root, 'Choose another').props.onPress());
    expect(mockState.setModal).toHaveBeenCalledWith(SEND_MODAL.OPEN_CASHOUT_CURRENCY);
  });

  it('shows the chosen method’s fields once loaded', () => {
    query({ data: [PALMPAY, BANK] });
    const root = render();

    expect(texts(root)).toContain('Phone number');
    expect(texts(root)).not.toContain('Couldn’t load your payout details');
    expect(button(root, 'Continue')).toBeDefined();
  });

  describe('starting from the verified profile', () => {
    // What a one-method country (EUR → SEPA) reaches straight from the list:
    // the holder is locked, the address comes pre-filled, the IBAN is typed.
    const SEPA: TransfiCashoutPaymentMethod = {
      paymentCode: 'sepa',
      paymentType: 'bank_transfer',
      type: 'bank',
      fields: [
        {
          key: 'accountHolderName',
          label: 'Account holder',
          type: 'text',
          required: true,
          value: 'Ada Obi',
          locked: true,
        },
        {
          key: 'address',
          label: 'Address',
          type: 'text',
          required: true,
          value: '1 Rue de Rivoli',
        },
        { key: 'iban', label: 'IBAN', type: 'text', required: true },
      ],
    };

    beforeEach(() => {
      useCashoutStore.setState({ currency: 'EUR', paymentCode: 'sepa' });
    });

    it('fills an empty form with the profile’s values', () => {
      query({ data: [SEPA] });
      render();

      expect(useCashoutStore.getState().paymentDetails).toEqual({
        accountHolderName: 'Ada Obi',
        address: '1 Rue de Rivoli',
      });
    });

    it('keeps what was already typed when the form opens again', () => {
      const typed = { address: '2 Avenue Foch', iban: 'FR7630006000011234567890189' };
      useCashoutStore.setState({ paymentDetails: typed });
      query({ data: [SEPA] });

      render();
      expect(useCashoutStore.getState().paymentDetails).toEqual(typed);

      act(() => mounted.unmount());
      render();
      expect(useCashoutStore.getState().paymentDetails).toEqual(typed);
    });
  });
});
