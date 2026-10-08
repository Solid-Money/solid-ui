import React from 'react';

import {
  formatMicroDepositAmount,
  MicroDepositsCard,
} from '@/components/DepositOption/VirtualAccountDetails/MicroDepositsCard';
import { VirtualAccountMicroDeposit } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
// The copy button reaches expo-clipboard and the shared Button; what is copied
// is the prop, which is all these tests need to read.
jest.mock('@/components/CopyToClipboard', () => ({
  __esModule: true,
  default: 'CopyToClipboard',
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const deposit = (
  overrides: Partial<VirtualAccountMicroDeposit> = {},
): VirtualAccountMicroDeposit => ({
  id: 'micro-1',
  amount: '0.23',
  currency: 'usd',
  rail: 'ach',
  originatorName: 'EXAMPLE BANK NA',
  isAccountVerification: true,
  receivedAt: '2026-10-01T15:30:00Z',
  ...overrides,
});

const render = (deposits: VirtualAccountMicroDeposit[]) => {
  let tree: any;
  act(() => {
    tree = create(<MicroDepositsCard deposits={deposits} />);
  });
  return tree;
};

/** Every string the tree renders, concatenated — interpolations split children. */
const textOf = (tree: any): string => {
  const walk = (node: any): string => {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(walk).join('');
    return walk(node.children);
  };
  return walk(tree.toJSON());
};

describe('MicroDepositsCard', () => {
  it('always states the $2 minimum, even with nothing to show', () => {
    const text = textOf(render([]));

    expect(text).toContain("Bank deposits under $2 aren't added to your balance.");
    expect(text).not.toContain('Verification deposits');
  });

  it('lists each verification amount with who sent it, and asks for them to be confirmed', () => {
    const text = textOf(
      render([
        deposit(),
        deposit({ id: 'micro-2', amount: '0.07', receivedAt: '2026-10-02T09:00:00Z' }),
      ]),
    );

    expect(text).toContain('Verification deposits');
    expect(text).toContain('Enter these amounts with the bank or app that sent them');
    expect(text).toContain('$0.23');
    expect(text).toContain('$0.07');
    expect(text).toContain('EXAMPLE BANK NA');
  });

  it('copies the bare amount, which is what a bank form takes', () => {
    const tree = render([deposit({ amount: '0.1' })]);

    const copy = tree.root.findByType('CopyToClipboard');
    expect(copy.props.text).toBe('0.10');
  });

  it('marks a small payment as unprocessed instead of asking to confirm it', () => {
    const text = textOf(render([deposit({ amount: '1.50', isAccountVerification: false })]));

    expect(text).toContain('Deposits under $2');
    expect(text).toContain('Too small to process');
    expect(text).not.toContain('Enter these amounts');
  });
});

describe('formatMicroDepositAmount', () => {
  it('reads Rain’s amount as dollars, to two places', () => {
    expect(formatMicroDepositAmount('0.23')).toBe('0.23');
    expect(formatMicroDepositAmount('0.1')).toBe('0.10');
  });

  it('passes through a value it cannot read rather than showing NaN', () => {
    expect(formatMicroDepositAmount('abc')).toBe('abc');
  });
});
