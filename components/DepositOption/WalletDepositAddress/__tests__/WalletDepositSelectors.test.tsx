import React from 'react';
import { base } from 'viem/chains';

import WalletDepositSelectors from '@/components/DepositOption/WalletDepositAddress/WalletDepositSelectors';
import { DEPOSIT_MODAL } from '@/constants/modals';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('lucide-react-native', () => ({ Check: 'Check', ChevronDown: 'ChevronDown' }));
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: null }),
}));
jest.mock('@/hooks/useDepositTokensAccess', () => ({
  useDepositTokensAccess: () => ({ isEnabled: true, isLoading: false }),
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockDeposit),
}));

const mockDeposit = {
  setModal: jest.fn(),
  setWalletDeposit: jest.fn(),
};

const render = (isLocked: boolean, onToggleNetwork = jest.fn()) => {
  let root: any;
  act(() => {
    root = create(
      <WalletDepositSelectors
        chainId={base.id}
        symbol="USDC"
        isNetworkOpen={false}
        onToggleNetwork={onToggleNetwork}
        isLocked={isLocked}
      />,
    );
  });
  return root;
};

const pills = (root: any) =>
  root.root.findAll(
    (node: any) => node.props.accessibilityRole !== undefined && node.props.onPress !== undefined,
  );

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
});

describe('WalletDepositSelectors', () => {
  it('lets the currency and network be changed', () => {
    const onToggleNetwork = jest.fn();
    const root = render(false, onToggleNetwork);
    const [currency, network] = pills(root);

    act(() => currency.props.onPress());
    act(() => network.props.onPress());

    expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_DEPOSIT_TOKEN);
    expect(onToggleNetwork).toHaveBeenCalled();
    expect(root.root.findAll((node: any) => node.type === 'ChevronDown')).toHaveLength(2);
  });

  // The AI API's "Add funds": only USDC on Base funds its charges, so the pills
  // show the pairing without offering another.
  it('fixes both on what the screen was opened with when locked', () => {
    const onToggleNetwork = jest.fn();
    const root = render(true, onToggleNetwork);

    // Still names the pairing: it is what the user has to send.
    const labels = root.root
      .findAll((node: any) => node.type === 'Text')
      .map((node: any) => node.props.children);
    expect(labels).toEqual(expect.arrayContaining(['USDC', 'Base']));
    expect(pills(root)).toHaveLength(0);
    expect(root.root.findAll((node: any) => node.type === 'ChevronDown')).toHaveLength(0);
    expect(mockDeposit.setModal).not.toHaveBeenCalled();
    expect(onToggleNetwork).not.toHaveBeenCalled();
  });
});
