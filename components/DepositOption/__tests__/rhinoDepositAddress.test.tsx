import React from 'react';
import { base } from 'viem/chains';

import RhinoDepositAddress from '@/components/DepositOption/RhinoDeposit/RhinoDepositAddress';

import type { RhinoDeposit, RhinoDepositAddressResponse } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('lucide-react-native', () => ({
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  Info: 'Info',
}));
jest.mock('@/components/Card/CardFund/CardFundGroup', () => 'CardFundGroup');
jest.mock('@/components/Card/CardFund/CardFundRow', () => 'CardFundRow');
jest.mock('@/components/Card/CardFund/DepositScanningIndicator', () => 'DepositScanningIndicator');
jest.mock('@/components/CopyToClipboard', () => 'CopyToClipboard');
jest.mock('@/components/Tooltip', () => 'TooltipPopover');
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/hooks/useDetectedDirectDeposit', () => ({
  useDetectedDirectDeposit: (params: unknown) => mockDetected(params),
}));
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => undefined,
}));
jest.mock('@/hooks/useRhinoDepositAddress', () => ({
  useRhinoDepositAddress: () => mockAddress.current,
}));
jest.mock('@/hooks/useRhinoDeposits', () => ({
  useRhinoDeposits: () => ({ deposit: mockDeposit.current }),
}));

const mockDetected = jest.fn((_params: unknown) => ({ isDetected: false }));
const mockAddress: {
  current: { address?: RhinoDepositAddressResponse; isError: boolean; refetch: jest.Mock };
} = { current: { address: undefined, isError: false, refetch: jest.fn() } };
const mockDeposit: { current: RhinoDeposit | undefined } = { current: undefined };

const TRON_ADDRESS = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE';

const TRON_SAVINGS: RhinoDepositAddressResponse = {
  depositAddress: TRON_ADDRESS,
  chain: 'TRON',
  chainName: 'Tron',
  addressType: 'TRON',
  tokenSymbol: 'USDT',
  tokenAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  destinationType: 'PROTOCOL',
  receiveSymbol: 'USDC',
  receiveChainId: base.id,
  vault: 'soUSD',
  minimumUsd: 5,
  maximumUsd: 100000,
};

const SELECTION = {
  chain: 'TRON',
  tokenSymbol: 'USDT',
  destinationType: 'PROTOCOL' as const,
  vault: 'soUSD',
};

let root: any;

const render = () => {
  act(() => {
    root = create(<RhinoDepositAddress selection={SELECTION} onChangeNetwork={jest.fn()} />);
  });
  return root;
};

const texts = (): string[] =>
  root.root
    .findAll((node: any) => node.type === 'Text')
    .map((node: any) => node.props.children)
    .filter((child: unknown) => typeof child === 'string');

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockAddress.current = { address: TRON_SAVINGS, isError: false, refetch: jest.fn() };
  mockDeposit.current = undefined;
});

afterEach(() => {
  act(() => root?.unmount());
});

describe('RhinoDepositAddress', () => {
  it('shows a Tron address shortened, and copies and encodes it whole', () => {
    render();

    expect(texts()).toContain('TQn9Y2k...cbLSE');
    expect(root.root.findByType('QRCode').props.value).toBe(TRON_ADDRESS);
    expect(root.root.findByType('CopyToClipboard').props.text).toBe(TRON_ADDRESS);
  });

  it('says what to send, within which limits, and what arrives', () => {
    render();

    expect(texts()).toEqual(
      expect.arrayContaining([
        'Send only USDT on Tron',
        'Min $5 · Max $100,000 per deposit',
        'Converted to USDC in your savings (soUSD)',
      ]),
    );
  });

  // The chain has no logo in the repo, so the QR goes without one rather than
  // borrowing another chain's.
  it('leaves the logo off the QR for a chain without one', () => {
    render();
    expect(root.root.findByType('QRCode').props.logo).toBeUndefined();
  });

  it('hands off to the regular detection once the payout reaches savings', () => {
    render();
    expect(mockDetected).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true, destinationType: 'PROTOCOL' }),
    );
  });

  it('offers a retry when the address could not be fetched', () => {
    mockAddress.current = { address: undefined, isError: true, refetch: jest.fn() };
    render();

    expect(root.root.findAllByType('QRCode')).toHaveLength(0);
    expect(texts()).toContain('Could not load the deposit address.');
    const retry = root.root
      .findAllByType('Button')
      .find((node: any) => node.props.variant === 'secondary');
    act(() => retry.props.onPress());
    expect(mockAddress.current.refetch).toHaveBeenCalled();
  });

  it('explains a rejected deposit', () => {
    mockDeposit.current = {
      id: 'd1',
      chain: 'TRON',
      depositAddress: TRON_ADDRESS,
      txHash: 'abc',
      tokenSymbol: 'USDT',
      amount: '1',
      status: 'REJECTED',
      rejectReason: 'UNDER_MIN',
      destinationType: 'PROTOCOL',
      receiveSymbol: 'USDC',
      receiveChainId: base.id,
      createdAt: '2026-11-02T10:00:00.000Z',
      updatedAt: '2026-11-02T10:00:00.000Z',
    };
    render();

    expect(texts()).toEqual(
      expect.arrayContaining([
        'Deposit couldn’t be processed',
        'It was below the minimum for this network. Contact support for help.',
      ]),
    );
  });
});
