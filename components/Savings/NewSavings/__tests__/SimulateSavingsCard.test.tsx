import React from 'react';

import SimulateSavingsCard from '@/components/Savings/NewSavings/SimulateSavingsCard';
import { VaultType } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/CountUp', () => ({ __esModule: true, default: 'CountUp' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/Savings/NewSavings/AmountDropdown', () => ({
  __esModule: true,
  default: 'AmountDropdown',
  SIMULATE_AMOUNTS: [100, 1000, 10000],
}));
jest.mock('@/components/Savings/NewSavings/SimulateChart', () => ({
  __esModule: true,
  default: 'SimulateChart',
}));
jest.mock('@/hooks/useDebounce', () => ({ __esModule: true, default: (value: unknown) => value }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

it('uses balances arriving after mount while retaining a manual selection between balance updates', () => {
  let tree: any;
  act(() => {
    tree = create(<SimulateSavingsCard vaultType={VaultType.USDC} apy={5} />);
  });
  const dropdown = () => tree.root.findByType('AmountDropdown');
  expect(dropdown().props.amount).toBe(10000);
  act(() => {
    tree.update(
      <SimulateSavingsCard vaultType={VaultType.USDC} apy={5} initialPrincipal={2450.4} />,
    );
  });
  expect(dropdown().props.amount).toBe(2450);
  act(() => {
    dropdown().props.onSelect(100);
  });
  act(() => {
    tree.update(
      <SimulateSavingsCard vaultType={VaultType.USDC} apy={6} initialPrincipal={2450.4} />,
    );
  });
  expect(dropdown().props.amount).toBe(100);
  act(() => {
    tree.update(<SimulateSavingsCard vaultType={VaultType.USDC} apy={6} initialPrincipal={3000} />);
  });
  expect(dropdown().props.amount).toBe(3000);
  act(() => {
    tree.update(<SimulateSavingsCard vaultType={VaultType.USDC} apy={6} />);
  });
  expect(dropdown().props.amount).toBe(3000);
  act(() => tree.unmount());
});
