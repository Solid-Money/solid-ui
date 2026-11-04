import React from 'react';
import { base, fuse, mainnet } from 'viem/chains';

import WalletDepositAddress from '@/components/DepositOption/WalletDepositAddress';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { RHINO_ASSETS } from '@/lib/__tests__/rhinoFixtures';
import { CardProvider } from '@/lib/types';

import type { WalletDepositViewer } from '@/components/DepositOption/WalletDepositAddress/constants';
import type { RhinoDepositAddressResponse } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('lucide-react-native', () => ({ ChevronRight: 'ChevronRight' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/CopyToClipboard', () => 'CopyToClipboard');
jest.mock('@/components/DepositOption/DepositFeeNotice', () => 'DepositFeeNotice');
jest.mock('@/components/Card/CardFund/DepositScanningIndicator', () => 'DepositScanningIndicator');
jest.mock('@/components/DepositOption/WalletDepositAddress/WalletDepositSelectors', () => ({
  __esModule: true,
  default: 'WalletDepositSelectors',
  WalletDepositNetworkList: 'WalletDepositNetworkList',
}));
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/help/links', () => ({ openHelpLink: jest.fn() }));
jest.mock('@/lib/utils', () => ({ eclipseAddress: (address: string) => address }));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: 'wirex' }),
}));
jest.mock('@/hooks/useDepositAssets', () => ({
  useDepositAssets: () => ({ data: undefined }),
}));
jest.mock('@/hooks/useEuroSpendEnablement', () => ({
  useEuroSpendEnablement: () => ({ shouldOffer: false }),
}));
// Our own address: minted for a Wirex cardholder's Fuse row, nothing otherwise.
jest.mock('@/hooks/useWalletDepositAddress', () => ({
  useWalletDepositAddress: (chainId: number, symbol: string, options: { enabled?: boolean }) =>
    mockWalletAddress(chainId, symbol, options),
}));
jest.mock('@/components/DepositOption/WalletDepositAddress/useWalletDepositViewer', () => ({
  useWalletDepositViewer: () => mockViewer.current,
}));
jest.mock('@/hooks/useDetectedDirectDeposit', () => ({
  useDetectedDirectDeposit: (params: any) => {
    mockDetected.params = params;
    return { isDetected: false };
  },
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => ({ ...mockViewer.current.rhino, retry: mockRetryAssets }),
}));
jest.mock('@/hooks/useRhinoDepositAddress', () => ({
  useRhinoDepositAddress: (selection: unknown) => mockRhinoAddress(selection),
}));
jest.mock('@/components/DepositOption/RhinoDeposit/useRhinoAddressAnalytics', () => ({
  useRhinoAddressAnalytics: () => jest.fn(),
}));
jest.mock('@/components/DepositOption/RhinoDeposit/RhinoDepositStatus', () => 'RhinoDepositStatus');
jest.mock(
  '@/components/DepositOption/RhinoDeposit/RhinoDepositDetails',
  () => 'RhinoDepositDetails',
);
jest.mock('@/components/DepositOption/RhinoDeposit/RhinoChainIcon', () => ({
  __esModule: true,
  default: 'RhinoChainIcon',
  getRhinoChainIcon: () => undefined,
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockDeposit),
}));

const mockRouter = { push: jest.fn() };
const mockDetected: { params?: any } = {};
const mockDeposit = {
  walletDeposit: { chainId: fuse.id as number, symbol: 'USDC' },
  setModal: jest.fn(),
  setWalletDeposit: jest.fn(),
};
const WIREX_READY: WalletDepositViewer = {
  provider: CardProvider.WIREX,
  hasNewTokens: true,
  rhino: { status: 'ready', assets: RHINO_ASSETS },
};
const mockViewer: { current: WalletDepositViewer } = { current: WIREX_READY };
const mockRetryAssets = jest.fn();
const mockWalletAddress = jest.fn(
  (_chainId: number, _symbol: string, options: { enabled?: boolean }) =>
    options?.enabled === false
      ? { address: undefined, isError: false, isMinted: false }
      : { address: '0xabc', isError: false, isMinted: true },
);
const RHINO_ADDRESS = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
const rhinoResponse = (destinationType: 'WALLET' | 'RAIN_CARD'): RhinoDepositAddressResponse => ({
  depositAddress: RHINO_ADDRESS,
  chain: 'BASE',
  chainName: 'Base',
  addressType: 'EVM',
  tokenSymbol: 'USDC',
  tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  destinationType,
  receiveSymbol: 'USDC',
  receiveChainId: base.id,
  minimumUsd: 5,
  maximumUsd: 100000,
});
const mockRhinoRefetch = jest.fn();
const mockRhinoAddress = jest.fn((selection: unknown): any =>
  selection
    ? {
        address: rhinoResponse((selection as { destinationType: 'WALLET' }).destinationType),
        isError: false,
        isFetching: false,
        refetch: mockRhinoRefetch,
      }
    : { address: undefined, isError: false, isFetching: false, refetch: mockRhinoRefetch },
);

let root: any;
const render = () => {
  act(() => {
    root = create(<WalletDepositAddress />);
  });
  return root;
};

const texts = (): string[] =>
  root.root
    .findAll((node: any) => node.type === 'Text')
    .map((node: any) => node.props.children)
    .filter((child: unknown) => typeof child === 'string');

const qrValues = (): string[] =>
  root.root.findAllByType('QRCode').map((node: any) => node.props.value);

/** The "Try again" in the QR's place, not "Copy address". */
const retryButton = () =>
  root.root.findAllByType('Button').find((node: any) => node.props.variant === 'secondary');

/** Whether our own address was asked for, for any row rendered. */
const ownAddressWasEnabled = () =>
  mockWalletAddress.mock.calls.some(([, , options]) => options?.enabled !== false);

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockDetected.params = undefined;
  mockViewer.current = WIREX_READY;
  mockDeposit.walletDeposit = { chainId: fuse.id, symbol: 'USDC' };
});

afterEach(() => {
  act(() => root?.unmount());
});

describe('WalletDepositAddress on Fuse, our own row', () => {
  it('watches the minted address for a deposit', () => {
    render();

    expect(mockDetected.params).toEqual(
      expect.objectContaining({ enabled: true, onDetected: expect.any(Function) }),
    );
  });

  it("closes the sheet and opens the deposit's progress once it is detected", () => {
    render();

    act(() => {
      mockDetected.params.onDetected({ detected: true, clientTxId: 'direct_deposit_123' });
    });

    expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.CLOSE);
    expect(mockRouter.push).toHaveBeenCalledWith('/activity/direct_deposit_123');
  });

  it('stays put when the detected deposit has no activity to open', () => {
    render();

    act(() => {
      mockDetected.params.onDetected({ detected: true });
    });

    expect(mockDeposit.setModal).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('keeps working while rhino.fi’s routes cannot be had', () => {
    mockViewer.current = { ...WIREX_READY, rhino: { status: 'unavailable' } };
    render();

    expect(qrValues()).toEqual(['0xabc']);
    expect(mockRhinoAddress).toHaveBeenLastCalledWith(undefined);
  });
});

describe('WalletDepositAddress off Fuse, rhino.fi’s row', () => {
  beforeEach(() => {
    mockDeposit.walletDeposit = { chainId: base.id, symbol: 'USDC' };
  });

  // Base is the chain the wallet route pays out on, and goes through rhino.fi too.
  it('shows the rhino.fi address on Base, and never our own', () => {
    render();

    expect(qrValues()).toEqual([RHINO_ADDRESS]);
    expect(ownAddressWasEnabled()).toBe(false);
    expect(root.root.findAllByType('DepositFeeNotice')).toHaveLength(0);
    expect(root.root.findAllByType('RhinoDepositDetails')).toHaveLength(1);
  });

  // A Wirex cardholder's dollars take the card route, which pays their card
  // address — watched by the pipeline, so its detection hands them to activity.
  it('takes a Wirex cardholder’s USDC through the card route, and watches for the payout', () => {
    render();

    expect(mockRhinoAddress).toHaveBeenLastCalledWith(
      expect.objectContaining({ chain: 'BASE', chainId: base.id, destinationType: 'RAIN_CARD' }),
    );
    expect(root.root.findByType('RhinoDepositDetails').props.destinationType).toBe('RAIN_CARD');
    expect(mockDetected.params).toEqual(
      expect.objectContaining({ enabled: true, destinationType: 'RAIN_CARD' }),
    );
  });

  it('takes everyone else’s USDC through the wallet route', () => {
    mockViewer.current = { ...WIREX_READY, provider: null };
    render();

    expect(mockRhinoAddress).toHaveBeenLastCalledWith(
      expect.objectContaining({ destinationType: 'WALLET' }),
    );
    expect(mockDetected.params).toEqual(expect.objectContaining({ enabled: false }));
  });

  // No fallback: a failed rhino.fi address is a failure with a retry.
  it('offers a retry when the rhino.fi address cannot be had, and no address of ours', () => {
    mockRhinoAddress.mockImplementation(() => ({
      address: undefined,
      isError: true,
      isFetching: false,
      refetch: mockRhinoRefetch,
    }));
    render();

    expect(qrValues()).toEqual([]);
    expect(texts()).toContain('Could not load the deposit address.');
    expect(ownAddressWasEnabled()).toBe(false);
    act(() => retryButton().props.onPress());
    expect(mockRhinoRefetch).toHaveBeenCalled();
  });

  it('waits for rhino.fi’s routes rather than showing an address of ours', () => {
    mockViewer.current = { ...WIREX_READY, rhino: { status: 'loading' } };
    render();

    expect(qrValues()).toEqual([]);
    expect(ownAddressWasEnabled()).toBe(false);
    expect(mockRhinoAddress).toHaveBeenLastCalledWith(undefined);
  });

  it('offers a retry when rhino.fi’s routes cannot be had', () => {
    mockViewer.current = { ...WIREX_READY, rhino: { status: 'unavailable' } };
    render();

    expect(qrValues()).toEqual([]);
    expect(texts()).toContain('Couldn’t load this network.');
    expect(ownAddressWasEnabled()).toBe(false);
    act(() => retryButton().props.onPress());
    expect(mockRetryAssets).toHaveBeenCalled();
  });

  // Main currency and AI API open the screen on a chain of their own.
  it('moves a pairing rhino.fi has no route for to one it has', () => {
    mockViewer.current = {
      ...WIREX_READY,
      rhino: {
        status: 'ready',
        assets: {
          ...RHINO_ASSETS,
          chains: RHINO_ASSETS.chains.filter(chain => chain.chain !== 'BASE'),
        },
      },
    };
    render();

    expect(qrValues()).toEqual([]);
    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({
      chainId: mainnet.id,
      symbol: 'USDC',
    });
  });
});

describe('WalletDepositAddress for a token rhino.fi takes nowhere', () => {
  it('shows the Safe on Base', () => {
    mockDeposit.walletDeposit = { chainId: base.id, symbol: 'WETH' };
    render();

    expect(qrValues()).toEqual(['0xabc']);
    expect(mockRhinoAddress).toHaveBeenLastCalledWith(undefined);
  });

  it('moves off any other chain to Base', () => {
    mockDeposit.walletDeposit = { chainId: mainnet.id, symbol: 'WETH' };
    render();

    expect(qrValues()).toEqual([]);
    expect(ownAddressWasEnabled()).toBe(false);
    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({ chainId: base.id, symbol: 'WETH' });
  });
});
