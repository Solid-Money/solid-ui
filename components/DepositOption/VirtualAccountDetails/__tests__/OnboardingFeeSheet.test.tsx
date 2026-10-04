import React from 'react';

import { OnboardingFeeSheet } from '@/components/DepositOption/VirtualAccountDetails/OnboardingFeeSheet';
import { OnboardingFeeProduct } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/utils', () => ({
  formatNumber: (n: number, max = 6, min = 2) =>
    n.toLocaleString('en-US', {
      maximumFractionDigits: max,
      minimumFractionDigits: min,
    }),
}));

type PaymentState = ReturnType<typeof defaultPayment>;

const defaultPayment = () => ({
  feeUsd: 10 as number | undefined,
  satisfied: false,
  payment: { asset: { symbol: 'soUSD' } } as { asset: { symbol: string } } | undefined,
  availableUsd: 1284.5,
  insufficientFunds: false,
  isLoading: false,
  phase: 'idle' as const,
  error: null as string | null,
  pay: jest.fn().mockResolvedValue(true),
});

let mockPayment: PaymentState;
jest.mock('@/hooks/useOnboardingFee', () => ({
  useOnboardingFeePayment: () => mockPayment,
}));

beforeEach(() => {
  mockPayment = defaultPayment();
});

const render = (props: Partial<React.ComponentProps<typeof OnboardingFeeSheet>> = {}) => {
  let tree: any;
  act(() => {
    tree = create(
      <OnboardingFeeSheet
        product={OnboardingFeeProduct.RAIN_VIRTUAL_ACCOUNT}
        onDismiss={jest.fn()}
        onPaid={jest.fn()}
        {...props}
      />,
    );
  });
  return tree;
};

/**
 * Every string the tree renders, concatenated.
 *
 * Flattened rather than JSON-stringified because an interpolated line renders
 * as separate children (`["A one-time ", "$10", " fee"]`), so a search over the
 * raw tree would miss the very copy these tests are about.
 */
const textOf = (tree: any): string => {
  const walk = (node: any): string => {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(walk).join('');
    return walk(node.children);
  };

  return walk(tree.toJSON());
};

describe('OnboardingFeeSheet', () => {
  it('shows the quoted fee in prose without trailing zeros', () => {
    const text = textOf(render());

    expect(text).toContain('A one-time $10 fee');
    expect(text).toContain('Pay $10 and continue');
    expect(text).not.toContain('$10.00 and continue');
  });

  it('shows the fee table to two places, and what is available', () => {
    const text = textOf(render());

    expect(text).toContain('$10.00');
    expect(text).toContain('$1,284.50 available');
  });

  it('renders a non-round fee faithfully in both places', () => {
    mockPayment = { ...defaultPayment(), feeUsd: 12.5 };
    const text = textOf(render());

    expect(text).toContain('A one-time $12.5 fee');
    expect(text).toContain('$12.50');
  });

  /**
   * $0 is a normal answer — the line ships off and a country can be exempted —
   * so the sheet must get out of the way rather than asking for nothing.
   */
  it('renders nothing and carries on when the fee is already settled', () => {
    const onPaid = jest.fn();
    mockPayment = { ...defaultPayment(), satisfied: true, feeUsd: 0 };

    const tree = render({ onPaid });

    expect(tree.toJSON()).toBeNull();
    expect(onPaid).toHaveBeenCalled();
  });

  it('renders nothing while the quote is still loading', () => {
    mockPayment = { ...defaultPayment(), isLoading: true };

    expect(render().toJSON()).toBeNull();
  });

  it('asks the user to add funds, and offers no payment, when short', () => {
    mockPayment = { ...defaultPayment(), insufficientFunds: true, payment: undefined };
    const text = textOf(render());

    expect(text).toContain('Add at least $10 to your Solid balance');
    expect(text).not.toContain('Next, you’ll verify your identity');
  });

  it('surfaces the server’s own reason over the standing footnote', () => {
    mockPayment = { ...defaultPayment(), error: 'That payment has already been used.' };
    const text = textOf(render());

    expect(text).toContain('That payment has already been used.');
    expect(text).not.toContain('Next, you’ll verify your identity');
  });

  it('tells the user what happens next while nothing is wrong', () => {
    expect(textOf(render())).toContain('Next, you’ll verify your identity');
  });
});
