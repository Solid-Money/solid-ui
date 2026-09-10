import React from 'react';
import { router } from 'expo-router';

import ManageCardSheet from '@/components/Card/NewCardDetails/ManageCardSheet';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
let mockWirex = true;
const mockWithdraw = jest.fn();
jest.mock('@/hooks/useCardSpendRegistration', () => ({
  useCardSpendRegistration: () => ({
    isAvailable: mockWirex,
    registration: null,
    isRegistered: false,
    isPaused: false,
    isRegistering: false,
    isUpdatingLimit: false,
    isDisabling: false,
    isLoading: false,
    refetch: jest.fn(),
    limit: null,
    error: null,
    register: jest.fn(),
    updateLimit: jest.fn(),
    disable: jest.fn(),
  }),
}));
jest.mock('@/hooks/useWirexThreeDs', () => ({
  useWirexThreeDs: () => ({ isSupported: mockWirex, requests: mockWirex ? [{}] : [] }),
}));
jest.mock('@/store/useCardWithdrawStore', () => ({
  useCardWithdrawStore: (select: any) => select({ setModal: mockWithdraw }),
}));
jest.mock('@/lib/assets', () => ({ getAsset: (asset: string) => asset }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/components/Card/NewCardDetails/EditSpendLimitStep', () => 'EditSpendLimitStep');
jest.mock('@/components/Card/NewCardDetails/SpendingLimitsStep', () => 'SpendingLimitsStep');
jest.mock(
  '@/components/ResponsiveModal',
  () =>
    ({ children }: any) =>
      children,
);
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));

const render = (canWithdraw = false) => {
  const props = {
    isOpen: true,
    onOpenChange: jest.fn(),
    onAddToWallet: jest.fn(),
    canWithdraw,
  };
  let tree: any;
  act(() => {
    tree = create(<ManageCardSheet {...props} />);
  });
  const buttons = tree.root.findAll(
    (node: any) => typeof node.type === 'string' && node.props.accessibilityRole === 'button',
  );
  return { props, tree, buttons };
};

const press = (button: any) => {
  let target = button;
  while (target && typeof target.props.onPress !== 'function') target = target.parent;
  act(() => target.props.onPress());
};

afterEach(() => {
  jest.clearAllMocks();
  mockWirex = true;
});

test('Wirex exposes limits, wallet and pending approvals; closes before opening the next flow', () => {
  const { props, tree, buttons } = render();
  expect(buttons.map((button: any) => button.props.accessibilityLabel)).toEqual([
    'Edit limit',
    'Add to Apple Wallet',
    'Approvals, 1 waiting',
  ]);
  press(buttons[0]);
  press(buttons[2]);
  expect(props.onOpenChange).toHaveBeenCalledWith(false);
  expect(router.push).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test('Rain retains withdrawal without unsupported limit and approval controls', () => {
  mockWirex = false;
  const { props, tree, buttons } = render(true);
  expect(buttons.map((button: any) => button.props.accessibilityLabel)).toEqual([
    'Add to Apple Wallet',
    'Withdraw',
  ]);
  press(buttons[0]);
  expect(props.onAddToWallet).toHaveBeenCalledTimes(1);
  press(buttons[1]);
  expect(mockWithdraw).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

test('restricted Rain cards cannot withdraw', () => {
  mockWirex = false;
  const { tree, buttons } = render();
  expect(buttons.map((button: any) => button.props.accessibilityLabel)).toEqual([
    'Add to Apple Wallet',
  ]);
  act(() => tree.unmount());
});
