import React from 'react';

import DeleteAccountModal, { isDeleteConfirmation } from '@/components/Settings/DeleteAccountModal';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let mockWalletUsd = 0;
let mockSavingsUsd: number | undefined = 0;

jest.mock('@/hooks/useWalletTokens', () => ({
  useWalletTokens: () => ({ totalUSDExcludingVaultTokens: mockWalletUsd }),
}));
jest.mock('@/hooks/useTotalSavingsUSD', () => ({
  useTotalSavingsUSD: () => ({ data: mockSavingsUsd }),
}));
jest.mock('@/lib/utils', () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(' '),
  formatBalanceUSD: (value: number) => `$${value.toFixed(2)}`,
}));
jest.mock('@/components/ui/input', () => 'Input');
jest.mock('lucide-react-native', () => ({ AlertTriangle: 'AlertTriangle', X: 'X' }));

const render = (props: Partial<React.ComponentProps<typeof DeleteAccountModal>> = {}) => {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  let tree: any;
  act(() => {
    tree = create(
      <DeleteAccountModal
        visible
        isDeleting={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
        {...props}
      />,
    );
  });
  return { tree, onConfirm, onCancel };
};

/** The "Delete Account" button — the pressable that owns the destructive action. */
const deleteButton = (tree: any) =>
  tree.root.find(
    (node: any) => node.props.accessibilityLabel === 'Delete Account' && node.props.onPress,
  );

const typeConfirmation = (tree: any, text: string) => {
  act(() => {
    tree.root.findByType('Input').props.onChangeText(text);
  });
};

const allText = (tree: any): string =>
  tree.root
    .findAll((node: any) => typeof node.children?.[0] === 'string')
    .map((node: any) => node.children.join(''))
    .join(' ');

afterEach(() => {
  mockWalletUsd = 0;
  mockSavingsUsd = 0;
});

/**
 * A user closed an account holding $28 with two taps, then could not sign back
 * in to reach it — a closed account refuses every sign-in. Deleting now takes a
 * typed word, and says what the user still holds before they do it.
 */
describe('DeleteAccountModal', () => {
  test('does not delete until the confirmation word is typed', () => {
    const { tree, onConfirm } = render();

    expect(deleteButton(tree).props.disabled).toBe(true);
    act(() => deleteButton(tree).props.onPress());
    expect(onConfirm).not.toHaveBeenCalled();

    typeConfirmation(tree, 'DELET');
    expect(deleteButton(tree).props.disabled).toBe(true);

    act(() => tree.unmount());
  });

  test('deletes once the word is typed, whatever the case', () => {
    const { tree, onConfirm } = render();

    typeConfirmation(tree, ' delete ');
    expect(deleteButton(tree).props.disabled).toBe(false);

    act(() => deleteButton(tree).props.onPress());
    expect(onConfirm).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });

  test('warns what the user still holds before they delete', () => {
    mockWalletUsd = 28.01;
    mockSavingsUsd = 0.04;
    const { tree } = render();

    expect(allText(tree)).toContain('You still have at least $28.05 in Solid');

    act(() => tree.unmount());
  });

  test('says nothing about money to a user who holds none', () => {
    mockSavingsUsd = undefined;
    const { tree } = render();

    expect(allText(tree)).not.toContain('You still have');

    act(() => tree.unmount());
  });

  test('forgets what was typed once it closes', () => {
    const { tree, onConfirm, onCancel } = render();
    typeConfirmation(tree, 'DELETE');

    act(() => {
      tree.update(
        <DeleteAccountModal
          visible={false}
          isDeleting={false}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />,
      );
    });
    act(() => {
      tree.update(
        <DeleteAccountModal visible isDeleting={false} onCancel={onCancel} onConfirm={onConfirm} />,
      );
    });

    expect(deleteButton(tree).props.disabled).toBe(true);

    act(() => tree.unmount());
  });
});

describe('isDeleteConfirmation', () => {
  test.each([
    ['DELETE', true],
    ['delete', true],
    ['  Delete  ', true],
    ['DELETED', false],
    ['', false],
  ])('%p -> %p', (typed, expected) => {
    expect(isDeleteConfirmation(typed)).toBe(expected);
  });
});
