import React from 'react';
import { base, fuse, mainnet, optimism, polygon } from 'viem/chains';

import WalletDepositAddress from '@/components/DepositOption/WalletDepositAddress';
import { getWalletOwnAddress } from '@/components/DepositOption/WalletDepositAddress/constants';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { RHINO_ASSETS, RHINO_ASSETS_WITH_BITCOIN } from '@/lib/__tests__/rhinoFixtures';
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
// Our own address, as `getWalletOwnAddress` decides it: minted (a Wirex
// cardholder's Fuse dollars), or the Safe.
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
const SAFE_ADDRESS = '0x5afe000000000000000000000000000000005afe';
const mockOwnAddress = (...args: Parameters<typeof getWalletOwnAddress>) =>
  getWalletOwnAddress(...args);
const mockWalletAddress = jest.fn(
  (chainId: number, symbol: string, options: { enabled?: boolean }) => {
    if (options?.enabled === false) return { address: undefined, isError: false, isMinted: false };
    const own = mockOwnAddress(chainId, symbol, mockViewer.current.provider);
    return own?.kind === 'session'
      ? {
          address: '0xabc',
          isError: false,
          isMinted: true,
          sessionDestination: own.destinationType,
        }
      : { address: own ? SAFE_ADDRESS : undefined, isError: false, isMinted: false };
  },
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
const rhinoAddressFor = (selection: unknown): any =>
  selection
    ? {
        address: rhinoResponse((selection as { destinationType: 'WALLET' }).destinationType),
        isError: false,
        isFetching: false,
        refetch: mockRhinoRefetch,
      }
    : { address: undefined, isError: false, isFetching: false, refetch: mockRhinoRefetch };
const mockRhinoAddress = jest.fn(rhinoAddressFor);

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
  // A case that fails the rhino.fi address must not fail it for the next one.
  mockRhinoAddress.mockImplementation(rhinoAddressFor);
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
      expect.objectContaining({
        enabled: true,
        destinationType: 'RAIN_CARD',
        onDetected: expect.any(Function),
      }),
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

  // A Wirex cardholder's dollars off Fuse land in the Safe on Base, like anyone's.
  it('takes a Wirex cardholder’s USDC through the wallet route', () => {
    render();

    expect(mockRhinoAddress).toHaveBeenLastCalledWith(
      expect.objectContaining({ chain: 'BASE', chainId: base.id, destinationType: 'WALLET' }),
    );
    expect(root.root.findByType('RhinoDepositDetails').props.destinationType).toBe('WALLET');
    expect(mockDetected.params).toEqual(expect.objectContaining({ enabled: false }));
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

    expect(qrValues()).toEqual([SAFE_ADDRESS]);
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

/**
 * USDT is rhino.fi's off Base, paid to the Safe on Base as USDC; sent on Base,
 * our own pipeline keeps it, and the address is the Safe.
 */
describe('WalletDepositAddress for USDT', () => {
  [CardProvider.WIREX, null].forEach(provider => {
    it(`shows the rhino.fi wallet address off Base, paying USDC (${provider ?? 'no card'})`, () => {
      mockViewer.current = { ...WIREX_READY, provider };
      mockDeposit.walletDeposit = { chainId: polygon.id, symbol: 'USDT' };
      render();

      expect(qrValues()).toEqual([RHINO_ADDRESS]);
      expect(mockRhinoAddress).toHaveBeenLastCalledWith(
        expect.objectContaining({
          chain: 'MATIC_POS',
          tokenSymbol: 'USDT',
          destinationType: 'WALLET',
        }),
      );
      expect(ownAddressWasEnabled()).toBe(false);
      expect(root.root.findByType('RhinoDepositDetails').props.receiveSymbol).toBe('USDC');
      expect(root.root.findAllByType('DepositFeeNotice')).toHaveLength(0);
    });
  });

  it('hands out no address of ours off Base while rhino.fi’s routes cannot be had', () => {
    mockViewer.current = { ...WIREX_READY, rhino: { status: 'unavailable' } };
    mockDeposit.walletDeposit = { chainId: mainnet.id, symbol: 'USDT' };
    render();

    expect(qrValues()).toEqual([]);
    expect(ownAddressWasEnabled()).toBe(false);
  });

  // rhino.fi is not trusted to take USDT on Base; the Safe there can spend it as it lands.
  it('shows the Safe on Base, unwatched and with no fee', () => {
    mockDeposit.walletDeposit = { chainId: base.id, symbol: 'USDT' };
    render();

    expect(qrValues()).toEqual([SAFE_ADDRESS]);
    expect(mockRhinoAddress).toHaveBeenLastCalledWith(undefined);
    expect(root.root.findAllByType('DepositFeeNotice')).toHaveLength(0);
    expect(mockDetected.params).toEqual(expect.objectContaining({ enabled: false }));
  });

  // Our pipeline never watched Optimism; rhino.fi takes USDT there.
  it('takes USDT on Optimism through rhino.fi', () => {
    mockDeposit.walletDeposit = { chainId: optimism.id, symbol: 'USDT' };
    render();

    expect(qrValues()).toEqual([RHINO_ADDRESS]);
    expect(ownAddressWasEnabled()).toBe(false);
    expect(mockDeposit.setWalletDeposit).not.toHaveBeenCalled();
  });
});

/** A "More networks" chain is rhino.fi's address for it, drawn with rhino.fi's name. */
describe('WalletDepositAddress on a "More networks" chain', () => {
  it('shows the rhino.fi address for the chain, under its own name', () => {
    mockDeposit.walletDeposit = { chainId: base.id, symbol: 'USDC', rhinoChain: 'SOLANA' } as any;
    render();

    expect(mockRhinoAddress).toHaveBeenLastCalledWith({
      chain: 'SOLANA',
      tokenSymbol: 'USDC',
      destinationType: 'WALLET',
    });
    expect(ownAddressWasEnabled()).toBe(false);
    expect(root.root.findByType('WalletDepositSelectors').props.extraChain).toMatchObject({
      chain: 'SOLANA',
      name: 'Solana',
    });
    expect(root.root.findByType('RhinoDepositDetails').props.chainName).toBe('Solana');
  });

  it('goes back to the row when the chain does not take the currency', () => {
    mockDeposit.walletDeposit = { chainId: base.id, symbol: 'USDC', rhinoChain: 'TRON' } as any;
    render();

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({ rhinoChain: undefined });
  });

  it('is picked from the network list', () => {
    mockDeposit.walletDeposit = { chainId: base.id, symbol: 'USDC' };
    render();

    act(() => root.root.findByType('WalletDepositSelectors').props.onToggleNetwork());
    act(() => root.root.findByType('WalletDepositNetworkList').props.onSelectExtra('SOLANA'));

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({ rhinoChain: 'SOLANA' });
  });
});

describe('WalletDepositAddress for native BTC', () => {
  const BITCOIN_ADDRESS = 'bc1pwvza3f5hz85h9xdsmar8vjznsta9un82r5m5rvdsyys56u4xg75qytn3t4';

  beforeEach(() => {
    mockViewer.current = {
      ...WIREX_READY,
      rhino: { status: 'ready', assets: RHINO_ASSETS_WITH_BITCOIN },
    };
    mockRhinoAddress.mockImplementation((selection: unknown) => ({
      address: {
        ...rhinoResponse('WALLET'),
        depositAddress: BITCOIN_ADDRESS,
        chain: 'BITCOIN',
        chainName: 'Bitcoin',
        addressType: 'BTC',
        tokenSymbol: 'BTC',
        tokenAddress: '0x0000000000000000000000000000000000000000',
        receiveSymbol: 'WBTC',
        minimumUsd: 10,
        maximumUsd: 50000,
      },
      isError: false,
      isFetching: false,
      refetch: mockRhinoRefetch,
      selection,
    }));
  });

  it('shows its Bitcoin address, what lands, and how long Bitcoin takes', () => {
    mockDeposit.walletDeposit = { chainId: base.id, symbol: 'BTC', rhinoChain: 'BITCOIN' } as any;
    render();

    expect(mockRhinoAddress).toHaveBeenLastCalledWith({
      chain: 'BITCOIN',
      tokenSymbol: 'BTC',
      destinationType: 'WALLET',
    });
    expect(qrValues()).toEqual([BITCOIN_ADDRESS]);
    expect(ownAddressWasEnabled()).toBe(false);
    expect(root.root.findByType('RhinoDepositDetails').props).toMatchObject({
      tokenSymbol: 'BTC',
      chain: 'BITCOIN',
      chainName: 'Bitcoin',
      receiveSymbol: 'WBTC',
      minimumUsd: 10,
      maximumUsd: 50000,
    });
  });

  // Opened on a chain of the list's own (from elsewhere in the app, or left
  // over): there is none for BTC, so it moves to Bitcoin rather than to USDC.
  it('moves to Bitcoin when opened on a chain of the list’s own', () => {
    mockDeposit.walletDeposit = { chainId: base.id, symbol: 'BTC' };
    render();

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({ rhinoChain: 'BITCOIN' });
    expect(ownAddressWasEnabled()).toBe(false);
  });

  it('falls back to the default pairing once Bitcoin is switched off', () => {
    mockViewer.current = WIREX_READY;
    mockDeposit.walletDeposit = { chainId: base.id, symbol: 'BTC', rhinoChain: 'BITCOIN' } as any;
    render();

    expect(mockDeposit.setWalletDeposit).toHaveBeenCalledWith({ rhinoChain: undefined });
  });
});
