import React from 'react';

import { CashoutCurrencySelector } from '@/components/Send/Cashout/CashoutCurrencySelector';
import { SEND_MODAL } from '@/constants/modals';
import { useCashoutStore } from '@/store/useCashoutStore';

import type { TransfiCashoutConfig } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('lucide-react-native', () => ({ ChevronRight: 'ChevronRight', Search: 'Search' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/hooks/useDimension', () => ({ useDimension: () => ({ isScreenMedium: false }) }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/hooks/useTransfiCashout', () => ({
  useTransfiCashoutConfig: () => ({ data: mockState.config, isLoading: false, error: null }),
}));
jest.mock('@/store/useSendStore', () => ({
  useSendStore: (selector: (state: any) => unknown) => selector({ setModal: mockState.setModal }),
}));

const CONFIG: TransfiCashoutConfig = {
  currencies: [
    {
      currency: 'EUR',
      country: 'Eurozone',
      methods: [{ paymentCode: 'sepa', name: 'SEPA Instant', type: 'bank' }],
    },
    {
      currency: 'NGN',
      country: 'Nigeria',
      methods: [
        { paymentCode: 'palmpay', name: 'PalmPay', type: 'mobile_money' },
        { paymentCode: 'ng_bank', name: 'Bank account', type: 'bank' },
      ],
    },
    {
      currency: 'KES',
      country: 'Kenya',
      methods: [
        { paymentCode: 'mpesa', name: 'M-Pesa', type: 'mobile_money' },
        { paymentCode: 'airtel', name: 'Airtel Money', type: 'mobile_money' },
        { paymentCode: 't_kash', name: 'T-Kash', type: 'mobile_money' },
        { paymentCode: 'ke_bank', name: 'Bank account', type: 'bank' },
      ],
    },
  ],
  defaultCurrency: 'NGN',
  tokenSymbol: 'USDC',
  tokenNetwork: 'Base',
  chainId: 8453,
};

const mockState: { config?: TransfiCashoutConfig; setModal: jest.Mock } = {
  setModal: jest.fn(),
};

let mounted: any;

const render = () => {
  act(() => {
    mounted = create(<CashoutCurrencySelector />);
  });
  return mounted;
};

afterEach(() => {
  // The store outlives the test; an old tree must not hear the next reset.
  act(() => mounted?.unmount());
  mounted = undefined;
});

const texts = (root: any): string[] =>
  root.root
    .findAll((node: any) => node.type === 'Text')
    .map((node: any) => [node.props.children].flat().join(''));

const press = (root: any, label: string) => {
  const target = root.root.find(
    (node: any) =>
      typeof node.props.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.startsWith(label) &&
      typeof node.props.onPress === 'function',
  );
  act(() => target.props.onPress());
};

const pressChip = (root: any, label: string) => {
  const chip = root.root.find(
    (node: any) =>
      node.props.accessibilityRole === 'tab' &&
      typeof node.props.onPress === 'function' &&
      node.findAll((child: any) => child.type === 'Text' && child.props.children === label).length,
  );
  act(() => chip.props.onPress());
};

beforeEach(() => {
  mockState.config = CONFIG;
  mockState.setModal = jest.fn();
  useCashoutStore.getState().reset();
});

describe('CashoutCurrencySelector', () => {
  it('shows the user’s currency first, then every country with how it pays out', () => {
    const shown = texts(render());
    expect(shown).toEqual([
      'All',
      'Bank transfer',
      'Mobile money',
      'Your currency',
      'Nigeria',
      'NGN',
      'PalmPay',
      'Bank transfer',
      'All countries',
      'Eurozone',
      'EUR',
      'SEPA Instant',
      'Kenya',
      'KES',
      'M-Pesa',
      'Airtel Money',
      '+2',
    ]);
  });

  it('filters to countries with mobile money, leading with it', () => {
    const root = render();
    pressChip(root, 'Mobile money');
    const shown = texts(root);
    expect(shown).toContain('2 countries with mobile money');
    expect(shown).not.toContain('Eurozone');
    expect(shown).not.toContain('Your currency');
  });

  it('writes the picked filter in black on its white pill, through every switch', () => {
    const root = render();
    const labelColours = () =>
      root.root
        .findAll(
          (node: any) =>
            node.props.accessibilityRole === 'tab' && typeof node.props.onPress === 'function',
        )
        .map((tab: any) => {
          const label = tab.find((child: any) => child.type === 'Text');
          // In the style, not the classes: on the web a Text's colour classes
          // pile up across renders, and the white one wins.
          expect(label.props.className).not.toMatch(/text-(black|white)/);
          return [label.props.children, tab.props.accessibilityState.selected, label.props.style];
        });

    pressChip(root, 'Bank transfer');
    pressChip(root, 'All');
    expect(labelColours()).toEqual([
      ['All', true, { color: '#000000' }],
      ['Bank transfer', false, { color: '#ffffff' }],
      ['Mobile money', false, { color: '#ffffff' }],
    ]);
  });

  it('finds a country by a method’s name', () => {
    const root = render();
    const search = root.root.find(
      (node: any) => node.props.accessibilityLabel?.startsWith('Search') && node.props.onChangeText,
    );
    act(() => search.props.onChangeText('m-pesa'));
    const shown = texts(root);
    expect(shown).toContain('Kenya');
    expect(shown).not.toContain('Nigeria');
  });

  it('goes to the method step when there is a choice', () => {
    const root = render();
    press(root, 'Get paid in Nigeria');
    expect(useCashoutStore.getState().currency).toBe('NGN');
    expect(useCashoutStore.getState().paymentCode).toBeUndefined();
    expect(mockState.setModal).toHaveBeenCalledWith(SEND_MODAL.OPEN_CASHOUT_METHOD);
  });

  it('skips the method step for a country with one way to be paid', () => {
    const root = render();
    press(root, 'Get paid in Eurozone');
    expect(useCashoutStore.getState().currency).toBe('EUR');
    expect(useCashoutStore.getState().paymentCode).toBe('sepa');
    expect(mockState.setModal).toHaveBeenCalledWith(SEND_MODAL.OPEN_CASHOUT_DETAILS);
  });

  it('keeps what was typed when the same single-method country is picked again', () => {
    useCashoutStore.getState().setCurrency('EUR');
    useCashoutStore.getState().setPaymentCode('sepa');
    useCashoutStore.getState().setPaymentDetails({ iban: 'BE68539007547034' });
    const root = render();
    press(root, 'Get paid in Eurozone');
    expect(useCashoutStore.getState().paymentDetails).toEqual({ iban: 'BE68539007547034' });
  });

  it('lists bare codes without chips when the server sends no methods', () => {
    mockState.config = {
      ...CONFIG,
      defaultCurrency: undefined,
      currencies: [{ currency: 'EUR' }, { currency: 'NGN' }],
    };
    const root = render();
    expect(texts(root)).toEqual(['All countries', 'EUR', 'NGN']);
    press(root, 'Get paid in EUR');
    expect(mockState.setModal).toHaveBeenCalledWith(SEND_MODAL.OPEN_CASHOUT_METHOD);
  });
});
