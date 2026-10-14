import React from 'react';

import EarnView, { type EarnProduct } from '@/components/Earn/EarnView';
import { VaultType } from '@/lib/types';

const { act, create } = jest.requireActual('react-test-renderer');
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/skeleton', () => 'Skeleton');
jest.mock('@/components/Earn/YieldIcon', () => 'YieldIcon');
jest.mock('@/components/Savings/NewSavings/SavingsFundedActions', () => 'FundedActions');
jest.mock('@/components/Savings/NewSavings/StartEarningButton', () => 'StartEarning');
jest.mock('@/components/BalanceHeadline', () => ({
  BalanceHeadline: ({ balance, label }: any) =>
    jest.requireActual('react').createElement('Text', null, `${label} $${balance.toFixed(2)}`),
}));
jest.mock('@/components/Earn/EarnChips', () => {
  const { createElement } = jest.requireActual('react');
  return {
    EarnChip: ({ label }: { label: string }) => createElement('Text', null, label),
    ApyTag: ({ apy }: { apy?: number }) =>
      apy ? createElement('Text', null, `${apy.toFixed(1)}% APY`) : null,
    CheckDot: 'CheckDot',
    LockIcon: 'LockIcon',
  };
});
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
  formatNumber: (value: number, max = 2) =>
    value.toLocaleString('en-US', { maximumFractionDigits: max }),
}));

const product = (type: VaultType, overrides: Partial<EarnProduct> = {}): EarnProduct => ({
  type,
  valueUsd: 0,
  shareAmount: 0,
  apy: type === VaultType.USDC ? 4.5 : type === VaultType.ETH ? 2.9 : 7.5,
  isApyLoading: false,
  ...overrides,
});
// Figma 28551:5563.
const funded = [
  product(VaultType.USDC, { valueUsd: 2560, shareAmount: 2363.8 }),
  product(VaultType.ETH, { valueUsd: 310, shareAmount: 0.0752 }),
  product(VaultType.FUSE, { valueUsd: 120, lockedFuse: 10000 }),
];
const empty = [product(VaultType.USDC), product(VaultType.ETH), product(VaultType.FUSE)];

let root: any;
const onOpenProduct = jest.fn();
const render = (props: Partial<React.ComponentProps<typeof EarnView>> = {}) =>
  act(() => {
    root = create(
      <EarnView
        isLoading={false}
        total={2990}
        apyLabel="4.5% avg APY"
        totalEarned={104.2}
        past30={10.95}
        products={funded}
        onOpenProduct={onOpenProduct}
        {...props}
      />,
    );
  });
const textContent = () =>
  root.root
    .findAllByType('Text')
    .map((node: any) => node.children.filter((item: any) => typeof item === 'string').join(''))
    .join(' | ');
afterEach(() => {
  act(() => root?.unmount());
  jest.clearAllMocks();
});

it('shows what is in Earn, what it earned and each product (5d)', () => {
  render();
  const text = textContent();
  expect(text).toContain('Total in Earn $2990.00');
  expect(text).toContain('4.5% avg APY');
  expect(text).toContain('$104.20');
  expect(text).toContain('+$10.95');
  expect(text).toContain('Last 30 days');
  expect(text).toContain('$2,560.00');
  expect(text).toContain('2,363.80 soUSD');
  expect(text).toContain('0.0752 soETH');
  // The lock is part of FUSE Yield.
  expect(text).toContain('10,000 FUSE locked');
  expect(root.root.findAllByType('LockIcon')).toHaveLength(1);
  expect(root.root.findAllByType('FundedActions')).toHaveLength(1);
  expect(root.root.findAllByType('StartEarning')).toHaveLength(0);

  act(() => root.root.findAllByProps({ accessibilityLabel: 'Open ETH Yield' })[0].props.onPress());
  expect(onOpenProduct).toHaveBeenCalledWith(VaultType.ETH);
});

it('invites a first deposit when nothing is in Earn (5e)', () => {
  render({
    total: 0,
    apyLabel: 'Up to 7.5% APY',
    totalEarned: 0,
    past30: 0,
    products: empty,
  });
  const text = textContent();
  expect(text).toContain('Total in Earn $0.00');
  expect(text).toContain('Up to 7.5% APY');
  expect(text).not.toContain('+$');
  expect(text).toContain('7.5% APY');
  expect(text).not.toContain('soUSD');
  expect(root.root.findAllByType('StartEarning')).toHaveLength(1);
  expect(root.root.findAllByType('FundedActions')).toHaveLength(0);
});

it('waits for the figures rather than showing a wrong one', () => {
  render({ totalEarned: undefined, past30: undefined });
  expect(textContent()).not.toContain('$104.20');
  expect(textContent()).not.toContain('+$10.95');
  expect(root.root.findAllByType('Skeleton').length).toBeGreaterThanOrEqual(2);
});
