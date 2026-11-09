import React from 'react';
import { base, mainnet, polygon } from 'viem/chains';

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
  useOfferedRhinoDepositAssets: () => ({ status: 'loading', retry: jest.fn() }),
}));
jest.mock('@/hooks/useRhinoDepositAddress', () => ({
  useRhinoDepositAddress: (...args: unknown[]) => mockUseAddress(...args),
}));
jest.mock('@/hooks/useRhinoDeposits', () => ({
  useRhinoDeposits: () => ({ deposit: mockDeposit.current }),
}));

const mockDetected = jest.fn((_params: unknown) => ({ isDetected: false }));
const mockUseAddress = jest.fn((..._args: unknown[]) => mockAddress.current);
const mockAddress: {
  current: {
    address?: RhinoDepositAddressResponse;
    isError: boolean;
    isFetching: boolean;
    refetch: jest.Mock;
  };
} = { current: { address: undefined, isError: false, isFetching: false, refetch: jest.fn() } };
const mockDeposit: { current: RhinoDeposit | undefined } = { current: undefined };

const DEPOSIT_ADDRESS = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';

const POLYGON_SAVINGS: RhinoDepositAddressResponse = {
  depositAddress: DEPOSIT_ADDRESS,
  chain: 'MATIC_POS',
  chainName: 'Polygon PoS',
  addressType: 'EVM',
  tokenSymbol: 'USDT',
  tokenAddress: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
  destinationType: 'PROTOCOL',
  receiveSymbol: 'USDC',
  receiveChainId: mainnet.id,
  vault: 'soUSD',
  minimumUsd: 5,
  maximumUsd: 100000,
};

/** The Polygon row of the savings list, which rhino.fi serves. */
const SELECTION = {
  chain: 'MATIC_POS',
  chainId: polygon.id,
  tokenSymbol: 'USDT',
  destinationType: 'PROTOCOL' as const,
  vault: 'soUSD',
};

let root: any;

const render = (props: Partial<React.ComponentProps<typeof RhinoDepositAddress>> = {}) => {
  act(() => {
    root = create(
      <RhinoDepositAddress selection={SELECTION} onChangeNetwork={jest.fn()} {...props} />,
    );
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
  mockAddress.current = {
    address: POLYGON_SAVINGS,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  };
  mockDeposit.current = undefined;
});

afterEach(() => {
  act(() => root?.unmount());
});

describe('RhinoDepositAddress', () => {
  it('shows the address shortened, and copies and encodes it whole', () => {
    render();

    expect(texts()).toContain('0x8ba1f...DBA72');
    expect(root.root.findByType('QRCode').props.value).toBe(DEPOSIT_ADDRESS);
    expect(root.root.findByType('CopyToClipboard').props.text).toBe(DEPOSIT_ADDRESS);
  });

  // The row keeps the name it has in the list, not rhino.fi's "Polygon PoS".
  it('says what to send, within which limits, and what arrives, naming the row as the app does', () => {
    render();

    expect(texts()).toEqual(
      expect.arrayContaining([
        'Send only USDT on Polygon',
        'Min $5 · Max $100,000 per deposit',
        'Converted to USDC in your savings (soUSD)',
      ]),
    );
  });

  it('puts the row’s logo on the QR', () => {
    render();
    expect(root.root.findByType('QRCode').props.logo).toBeDefined();
  });

  it('hands off to the regular detection once the payout reaches savings', () => {
    render();
    expect(mockDetected).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true, destinationType: 'PROTOCOL' }),
    );
  });

  // rhino.fi is the only provider on the row: no address of ours stands in.
  it('offers a retry when the address could not be fetched', () => {
    mockAddress.current = {
      address: undefined,
      isError: true,
      isFetching: false,
      refetch: jest.fn(),
    };
    render();

    expect(root.root.findAllByType('QRCode')).toHaveLength(0);
    expect(texts()).toContain('Could not load the deposit address.');
    const retry = root.root
      .findAllByType('Button')
      .find((node: any) => node.props.variant === 'secondary');
    act(() => retry.props.onPress());
    expect(mockAddress.current.refetch).toHaveBeenCalled();
    // The hook toasts the failure itself; nothing asks it to stay quiet.
    expect(mockUseAddress).toHaveBeenCalledWith(SELECTION);
  });

  it('waits on the retry it started', () => {
    mockAddress.current = {
      address: undefined,
      isError: true,
      isFetching: true,
      refetch: jest.fn(),
    };
    render();

    expect(texts()).not.toContain('Could not load the deposit address.');
    expect(root.root.findAllByType('ActivityIndicator')).toHaveLength(1);
  });

  it('names the Base row as the app does', () => {
    render({ selection: { ...SELECTION, chain: 'BASE', chainId: base.id } });
    expect(texts()).toContain('Send only USDT on Base');
  });

  it('explains a rejected deposit', () => {
    mockDeposit.current = {
      id: 'd1',
      chain: 'MATIC_POS',
      depositAddress: DEPOSIT_ADDRESS,
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
