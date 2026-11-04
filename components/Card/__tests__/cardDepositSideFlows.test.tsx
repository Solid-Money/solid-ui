import React from 'react';
import { base, fuse, mainnet } from 'viem/chains';

import CardDirectDepositModalDesktop from '@/components/Card/CardDirectDepositModalDesktop';
import CardDirectDepositModalMobile from '@/components/Card/CardDirectDepositModalMobile';
import { RHINO_ASSETS } from '@/lib/__tests__/rhinoFixtures';
import { RHINO_NETWORK_CHIP } from '@/lib/rhinoDeposit';

import type { OfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * The Rain card's side flows onto rhino.fi: "Deposit from an external wallet"
 * on mobile, and the connected-wallet send on desktop. Off Fuse each sends to
 * the user's rhino.fi card address; only Fuse mints our own session.
 */

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@tanstack/react-query', () => ({
  useMutation: ({ onSuccess }: { onSuccess?: (data: unknown) => void }) => ({
    mutate: (variables: unknown) => {
      mockPrepare(variables);
      onSuccess?.({ walletAddress: SESSION_ADDRESS });
    },
  }),
}));
jest.mock('thirdweb/react', () => ({
  useActiveAccount: () => ({ address: '0x00000000000000000000000000000000000e0a00' }),
  useConnectModal: () => ({ connect: jest.fn() }),
}));
jest.mock('@/lib/thirdweb', () => ({ cleanupThirdwebStyles: jest.fn() }));
jest.mock('@/components/BuyCrypto/Transfi/BuyCryptoFlow', () => ({
  BuyCryptoFlowContent: 'BuyCryptoFlowContent',
}));
jest.mock('@/components/Card/CardFund/CardFundDepositAddress', () => 'CardFundDepositAddress');
jest.mock('@/components/Card/CardFund/CardFundNetworks', () => 'CardFundNetworks');
jest.mock('@/components/Card/CardFund/CardFundOptions', () => 'CardFundOptions');
jest.mock('@/components/Card/CardFund/constants', () => ({
  ...jest.requireActual('@/lib/utils/cardFunding'),
  getCardFundTokenIcon: (symbol: string) => symbol,
}));
jest.mock('@/components/DepositNetwork/DepositNetwork', () => 'DepositNetwork');
jest.mock('@/components/DepositOption/AddFundsToWalletForm', () => 'AddFundsToWalletForm');
jest.mock('@/components/DepositOption/DepositUsdOptions', () => ({
  UsdMethodList: 'UsdMethodList',
}));
jest.mock(
  '@/components/DepositOption/RhinoDeposit/RhinoDepositAddress',
  () => 'RhinoDepositAddress',
);
jest.mock(
  '@/components/DepositOption/RhinoDeposit/RhinoNetworksNotice',
  () => 'RhinoNetworksNotice',
);
jest.mock(
  '@/components/DepositOption/VirtualAccountDetails/VirtualAccountApplyDialog',
  () => 'VirtualAccountApplyDialog',
);
jest.mock('@/components/Orchestra/OrchestraFlow', () => ({
  OrchestraFlowContent: 'OrchestraFlowContent',
}));
jest.mock('@/components/ResponsiveModal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/hooks/useBuyCryptoEntry', () => ({
  useBuyCryptoEntry: () => ({ handleBuyCryptoPress: jest.fn() }),
}));
jest.mock('@/hooks/useCardStatus', () => ({ useCardStatus: () => ({ data: undefined }) }));
jest.mock('@/hooks/useFeatureAccess', () => ({ useHasFeature: () => false }));
jest.mock('@/hooks/useOnrampAutomation', () => ({
  useOnrampAutomation: () => ({ data: undefined }),
}));
jest.mock('@/hooks/useOrchestraCardEntry', () => ({
  useOrchestraCardEntry: () => ({ openCashApp: jest.fn(), isAvailable: false }),
}));
jest.mock('@/hooks/useVirtualAccountProvider', () => ({
  useVirtualAccountProvider: () => ({ provider: 'rain' }),
}));
jest.mock('@/hooks/useRhinoDepositAddress', () => ({
  useRhinoDepositAddress: (selection: unknown) => mockRhinoAddress(selection),
}));
jest.mock('@/hooks/useRhinoDepositAssets', () => {
  const { resolveRhinoRow } = jest.requireActual('@/lib/rhinoDeposit');
  return {
    useOfferedRhinoDepositAssets: () => mockRhino.current,
    useRhinoNetworkRows: (filter: object, rows: { chainId: number }[]) => ({
      rows: rows.map(row => ({
        row,
        state: resolveRhinoRow(mockRhino.current, { ...filter, chainId: row.chainId }),
      })),
      retry: mockRhino.current.retry,
    }),
  };
});
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/api', () => ({ createDirectDepositSession: jest.fn() }));
jest.mock('@/lib/buyCryptoFlow', () => ({
  getBuyCryptoBackTarget: () => null,
  getBuyCryptoTitle: () => '',
  getEmbeddedBuyCryptoTarget: () => null,
}));
jest.mock('@/lib/orchestraFlow', () => ({
  getOrchestraBackTarget: () => null,
  getOrchestraTitle: () => '',
  isOrchestraModal: () => false,
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (call: () => unknown) => call() }));
jest.mock('@/store/useCardDepositStore', () => ({
  useCardDepositStore: (selector: (state: any) => unknown) => selector({ setModal: jest.fn() }),
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockDepositStore),
}));
jest.mock('@/store/useTransfiStore', () => ({
  useTransfiStore: (selector: (state: any) => unknown) =>
    selector({ reset: jest.fn(), setFiatCurrency: jest.fn() }),
}));

const SESSION_ADDRESS = '0x5e55100000000000000000000000000000005e55';
const RHINO_ADDRESS = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
const mockPrepare = jest.fn();
const mockRetry = jest.fn();
const READY: OfferedRhinoDepositAssets = {
  status: 'ready',
  assets: RHINO_ASSETS,
  retry: mockRetry,
};
const mockRhino: { current: OfferedRhinoDepositAssets } = { current: READY };
const mockRhinoMinimum = { current: 5 };
const mockRhinoAddress = jest.fn((selection: unknown) => ({
  address: selection
    ? { depositAddress: RHINO_ADDRESS, minimumUsd: mockRhinoMinimum.current }
    : undefined,
  isError: false,
  isFetching: false,
  refetch: jest.fn(),
}));
const mockDepositStore = {
  setSrcChainId: jest.fn(),
  setPrincipalToken: jest.fn(),
  setModal: jest.fn(),
};

let root: any;
const render = (element: React.ReactElement) => {
  act(() => {
    root = create(element);
  });
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockRhino.current = READY;
  mockRhinoMinimum.current = 5;
});

afterEach(() => {
  act(() => root?.unmount());
});

describe('Rain card, mobile: "Deposit from an external wallet"', () => {
  const openExternalWallet = () =>
    act(() => root.root.findByType('CardFundOptions').props.onExternalWalletPress());

  // Our own address no longer serves every chain, so there is no shared
  // address to hand out: USDC on Base, at rhino.fi's card address.
  it('shows the rhino.fi card address for USDC on Base, minting no session', () => {
    render(<CardDirectDepositModalMobile isOpen onOpenChange={jest.fn()} />);
    openExternalWallet();

    expect(root.root.findByType('RhinoDepositAddress').props.selection).toEqual({
      chain: 'BASE',
      chainId: base.id,
      tokenSymbol: 'USDC',
      destinationType: 'RAIN_CARD',
    });
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('lists the USDC networks instead while rhino.fi’s routes are not in', () => {
    mockRhino.current = { status: 'loading', retry: mockRetry };
    render(<CardDirectDepositModalMobile isOpen onOpenChange={jest.fn()} />);
    openExternalWallet();

    expect(root.root.findAllByType('RhinoDepositAddress')).toHaveLength(0);
    expect(root.root.findByType('CardFundNetworks').props.symbol).toBe('USDC');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('mints the card session for USDT, our own pipeline’s', () => {
    render(<CardDirectDepositModalMobile isOpen onOpenChange={jest.fn()} />);
    act(() => root.root.findByType('CardFundOptions').props.onTokenPress('USDT'));
    act(() => root.root.findByType('CardFundNetworks').props.onSelect(mainnet.id));

    expect(mockPrepare).toHaveBeenCalledWith({ chainId: mainnet.id, token: 'USDT' });
    expect(root.root.findByType('CardFundDepositAddress').props.address).toBe(SESSION_ADDRESS);
  });

  it('shows a "More networks" chain’s rhino.fi address', () => {
    render(<CardDirectDepositModalMobile isOpen onOpenChange={jest.fn()} />);
    act(() => root.root.findByType('CardFundOptions').props.onTokenPress('USDC'));
    const selection = { chain: 'SOLANA', tokenSymbol: 'USDC', destinationType: 'RAIN_CARD' };
    act(() => root.root.findByType('CardFundNetworks').props.onSelectRhino(selection));

    expect(root.root.findByType('RhinoDepositAddress').props.selection).toEqual(selection);
    expect(mockPrepare).not.toHaveBeenCalled();
  });
});

describe('Rain card, desktop: the connected-wallet send', () => {
  const openWalletNetworks = async () => {
    await act(async () => {
      await root.root.findByType('CardFundOptions').props.onExternalWalletPress();
    });
  };
  const networks = () => root.root.findAllByType('DepositNetwork');
  const pressNetwork = (name: string) =>
    act(() =>
      networks()
        .find((node: any) => node.props.name === name)
        .props.onPress(),
    );

  it('lists the chains with an address, rhino.fi’s marked', async () => {
    render(<CardDirectDepositModalDesktop isOpen onOpenChange={jest.fn()} />);
    await openWalletNetworks();

    const descriptions = Object.fromEntries(
      networks().map((node: any) => [node.props.name, node.props.description]),
    );
    expect(Object.keys(descriptions)).toEqual(expect.arrayContaining(['Ethereum', 'Base', 'Fuse']));
    expect(descriptions.Base).toContain(RHINO_NETWORK_CHIP);
    expect(descriptions.Fuse).not.toContain(RHINO_NETWORK_CHIP);
  });

  it('sends to the rhino.fi card address off Fuse, minting no session', async () => {
    render(<CardDirectDepositModalDesktop isOpen onOpenChange={jest.fn()} />);
    await openWalletNetworks();
    pressNetwork('Base');

    expect(mockRhinoAddress).toHaveBeenLastCalledWith(
      expect.objectContaining({ chain: 'BASE', tokenSymbol: 'USDC', destinationType: 'RAIN_CARD' }),
    );
    const form = root.root.findByType('AddFundsToWalletForm');
    expect(form.props.destinationAddress).toBe(RHINO_ADDRESS);
    expect(form.props.minDeposit).toBe('10');
    expect(mockPrepare).not.toHaveBeenCalled();
    expect(mockDepositStore.setSrcChainId).toHaveBeenCalledWith(base.id);
  });

  // rhino.fi turns a deposit under its floor away.
  it('asks for at least rhino.fi’s minimum when it is above the card’s', async () => {
    mockRhinoMinimum.current = 25;
    render(<CardDirectDepositModalDesktop isOpen onOpenChange={jest.fn()} />);
    await openWalletNetworks();
    pressNetwork('Ethereum');

    expect(root.root.findByType('AddFundsToWalletForm').props.minDeposit).toBe('25');
  });

  it('keeps our own session on Fuse', async () => {
    render(<CardDirectDepositModalDesktop isOpen onOpenChange={jest.fn()} />);
    await openWalletNetworks();
    pressNetwork('Fuse');

    expect(mockPrepare).toHaveBeenCalledWith({ chainId: fuse.id, token: 'USDC' });
    expect(mockRhinoAddress).toHaveBeenLastCalledWith(undefined);
    expect(root.root.findByType('AddFundsToWalletForm').props.destinationAddress).toBe(
      SESSION_ADDRESS,
    );
  });

  it('offers only Fuse while rhino.fi’s routes are not in', async () => {
    mockRhino.current = { status: 'unavailable', retry: mockRetry };
    render(<CardDirectDepositModalDesktop isOpen onOpenChange={jest.fn()} />);
    await openWalletNetworks();

    expect(networks().map((node: any) => node.props.name)).toEqual(['Fuse']);
    expect(root.root.findByType('RhinoNetworksNotice').props.notice).toBe('unavailable');
  });
});
