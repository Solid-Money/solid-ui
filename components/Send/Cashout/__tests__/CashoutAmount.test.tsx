import React from 'react';
import { parseUnits } from 'viem';

import { CashoutAmount } from '@/components/Send/Cashout/CashoutAmount';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/lib/assets', () => ({ getAsset: () => 1 }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
  formatNumber: (value: number) => String(value),
}));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ fetchQuery: jest.fn() }) }));
jest.mock('@/hooks/useDebounce', () => ({ __esModule: true, default: (value: unknown) => value }));
jest.mock('@/hooks/useCashout', () => ({
  useCashoutUsdc: () => ({ balanceWei: mockState.balanceWei, decimals: 6, isLoading: false }),
}));
jest.mock('@/hooks/useTransfiCashout', () => ({
  cashoutQuoteQuery: jest.fn(),
  useTransfiCashoutConfig: () => ({ data: { tokenNetwork: 'Base', chainId: 8453 } }),
  useTransfiCashoutLimits: () => ({ data: mockState.limits, isLoading: mockState.limitsLoading }),
  useTransfiCashoutQuote: (amount: string, _c: string, _p: string, enabled: boolean) => {
    mockState.quotedWhileValid.push({ amount, enabled });
    return { data: mockState.quote, isFetching: false, error: null };
  },
}));
jest.mock('@/store/useSendStore', () => ({
  useSendStore: (selector: (state: any) => unknown) => selector({ setModal: jest.fn() }),
}));
jest.mock('@/store/useCashoutStore', () => ({
  useCashoutStore: (selector: (state: any) => unknown) =>
    selector({
      currency: 'ZMW',
      paymentCode: 'zm_mobile_money',
      usdcAmount: mockState.amount,
      setUsdcAmount: mockState.setAmount,
    }),
}));

const LIMITS = { minLimit: 26.256445, maxLimit: 100019.160769 };

const mockState: {
  amount: string;
  balanceWei: bigint;
  limits?: typeof LIMITS;
  limitsLoading: boolean;
  quote?: Record<string, unknown>;
  setAmount: jest.Mock;
  quotedWhileValid: { amount: string; enabled: boolean }[];
} = {
  amount: '',
  balanceWei: 0n,
  limitsLoading: false,
  setAmount: jest.fn(),
  quotedWhileValid: [],
};

const render = () => {
  let root: any;
  act(() => {
    root = create(<CashoutAmount />);
  });
  return root;
};

/** Every string rendered inside <Text>, in order. */
const texts = (root: any): string[] =>
  root.root
    .findAll((node: any) => node.type === 'Text')
    .map((node: any) => [node.props.children].flat().join(''));

const rowValue = (root: any, label: string): any => {
  const all = root.root.findAll((node: any) => node.type === 'Text');
  const index = all.findIndex((node: any) => node.props.children === label);
  return index >= 0 ? all[index + 1] : undefined;
};

const maxButton = (root: any) =>
  root.root.find((node: any) => node.props.accessibilityLabel === 'Use maximum amount');
const reviewButton = (root: any) => root.root.find((node: any) => node.type === 'Button');
const amountField = (root: any) =>
  root.root.find((node: any) => node.props.accessibilityLabel === 'USDC amount');

beforeEach(() => {
  mockState.amount = '';
  mockState.balanceWei = parseUnits('500', 6);
  mockState.limits = LIMITS;
  mockState.limitsLoading = false;
  mockState.quote = undefined;
  mockState.setAmount = jest.fn();
  mockState.quotedWhileValid = [];
});

describe('CashoutAmount', () => {
  it('shows the method’s limits under Rate and Fees', () => {
    const root = render();
    const lines = texts(root);
    expect(lines.indexOf('Limits')).toBeGreaterThan(lines.indexOf('Fees'));
    expect(rowValue(root, 'Limits').props.children).toBe('26.26 – 100,019.16 USDC per cash-out');
    expect(lines).toContain(
      'Cash-outs are provided by TransFi. Rates, fees and limits are set by TransFi and may change.',
    );
  });

  it('shows a dash while the limits load, and no row when they failed', () => {
    mockState.limits = undefined;
    mockState.limitsLoading = true;
    expect(rowValue(render(), 'Limits').props.children).toBe('—');

    mockState.limitsLoading = false;
    expect(texts(render())).not.toContain('Limits');
  });

  it('puts an amount below the minimum on the field, not in a quote', () => {
    mockState.amount = '10';
    const root = render();
    const lines = texts(root);

    expect(lines).toContain('The minimum cash-out is 26.26 USDC');
    expect(lines).not.toContain('Sent from your wallet on Base');
    expect(lines).toContain('— ZMW');
    expect(rowValue(root, 'Fees').props.children).toBe('—');
    expect(rowValue(root, 'Limits').props.className).toContain('text-warning');
    expect(amountField(root).props.accessibilityHint).toBe('The minimum cash-out is 26.26 USDC');
    expect(reviewButton(root).props.disabled).toBe(true);
    // Never quoted: TransFi would only refuse it.
    expect(mockState.quotedWhileValid.every(call => !call.enabled)).toBe(true);
  });

  it('keeps the limits row neutral for a balance problem', () => {
    mockState.amount = '600';
    const root = render();
    expect(texts(root)).toContain('That’s more than your balance');
    expect(rowValue(root, 'Limits').props.className).not.toContain('text-warning');
  });

  it('says a balance under the minimum as soon as it opens, and disables Max', () => {
    mockState.balanceWei = parseUnits('20', 6);
    const root = render();
    expect(texts(root)).toContain('You need at least 26.26 USDC to cash out');
    expect(maxButton(root).props.disabled).toBe(true);
  });

  it('fills the maximum, not the balance, when the balance is above it', () => {
    mockState.balanceWei = parseUnits('150000', 6);
    const root = render();
    act(() => maxButton(root).props.onPress());
    expect(mockState.setAmount).toHaveBeenCalledWith('100019.160769');
  });

  it('fills the balance when it is below the maximum', () => {
    const root = render();
    act(() => maxButton(root).props.onPress());
    expect(mockState.setAmount).toHaveBeenCalledWith('500');
  });

  it('enables Review for an amount inside the limits with its quote', () => {
    mockState.amount = '100';
    mockState.quote = {
      usdcAmount: '100',
      fiatCurrency: 'ZMW',
      paymentCode: 'zm_mobile_money',
      fiatAmount: 2400,
      totalFee: 12,
      ...LIMITS,
    };
    const root = render();
    expect(texts(root)).toContain('Sent from your wallet on Base');
    expect(reviewButton(root).props.disabled).toBe(false);
    expect(amountField(root).props.accessibilityHint).toBeUndefined();
  });

  it('checks only the balance when the limits are unavailable', () => {
    mockState.limits = undefined;
    mockState.amount = '1';
    const root = render();
    expect(texts(root)).toContain('Sent from your wallet on Base');
    expect(mockState.quotedWhileValid.at(-1)).toEqual({ amount: '1', enabled: true });
  });
});
