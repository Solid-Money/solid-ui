import React from 'react';
import { base, bsc, mainnet, polygon } from 'viem/chains';

import { WirexMoveAmount } from '@/components/Card/CardFund/WirexMoveFromWallet';
import { RHINO_ASSETS } from '@/lib/__tests__/rhinoFixtures';
import { createDirectDepositSession } from '@/lib/api';

import type { OfferedRhinoDepositAssets } from '@/hooks/useRhinoDepositAssets';
import type { MovableHolding } from '@/lib/utils/cardFundMove';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * "Move from wallet" for a Wirex cardholder: the transfer goes where a deposit
 * of the holding would — rhino.fi's wallet address for USDC, the card deposit
 * address (our own pipeline) for USDT — and never below rhino.fi's floor.
 */

jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/components/Card/CardFund/CardFundGroup', () => 'CardFundGroup');
jest.mock('@/components/Card/CardFund/CardFundRow', () => 'CardFundRow');
jest.mock('@/components/Card/CardFund/constants', () => ({
  ...jest.requireActual('@/lib/utils/cardFunding'),
  CARD_FUND_ESTIMATED_TIME: '~3 min',
  getCardFundTokenIcon: (symbol: string) => symbol,
}));
jest.mock(
  '@/components/DepositOption/RhinoDeposit/RhinoNetworksNotice',
  () => 'RhinoNetworksNotice',
);
jest.mock('@/components/Max', () => 'Max');
jest.mock('@/components/NeedHelp', () => 'NeedHelp');
jest.mock('@/components/RenderTokenIcon', () => 'RenderTokenIcon');
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/skeleton', () => 'Skeleton');
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/constants/cardSpendableAssets', () => ({
  CARD_SPENDABLE_ASSETS: [],
  describeCardSpendableAssets: () => 'USDC on Fuse',
}));
jest.mock('@/constants/swapChains', () => ({ SWAP_CHAIN_IDS: [] }));
jest.mock('@/hooks/useBalances', () => ({ useBalances: () => ({ tokens: [], isLoading: false }) }));
jest.mock('@/hooks/useSend', () => ({
  __esModule: true,
  default: () => ({ send: mockSend, sendStatus: 'idle', totpModal: null }),
}));
jest.mock('@/hooks/useRhinoDepositAddress', () => ({
  useRhinoDepositAddress: (selection: unknown) => mockRhinoAddress(selection),
}));
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => mockRhino.current,
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/api', () => ({ createDirectDepositSession: jest.fn() }));
jest.mock('@/lib/errors', () => ({ showFailureSheet: jest.fn() }));
jest.mock('@/lib/getTokenIcon', () => ({ __esModule: true, default: () => undefined }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
  formatNumber: (value: number) => String(value),
  withRefreshToken: (call: () => unknown) => call(),
}));

const RHINO_ADDRESS = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
const CARD_ADDRESS = '0x00000000000000000000000000000000000ca4d0';
const mockSend = jest.fn(async () => undefined);
const mockRhino: { current: OfferedRhinoDepositAssets } = {
  current: { status: 'ready', assets: RHINO_ASSETS, retry: jest.fn() },
};
const mockRhinoAddress = jest.fn((selection: unknown) => ({
  address: selection ? { depositAddress: RHINO_ADDRESS } : undefined,
  refetch: jest.fn(),
}));
const mockCreateSession = createDirectDepositSession as jest.MockedFunction<
  typeof createDirectDepositSession
>;

const holding = (chainId: number, symbol: string): MovableHolding => ({
  chainId,
  symbol,
  tokenAddress: '0x0000000000000000000000000000000000000001',
  decimals: 6,
  balance: '100000000',
  amount: 100,
  valueUSD: 100,
});

let root: any;
const render = (item: MovableHolding, amount: number) => {
  act(() => {
    root = create(<WirexMoveAmount holding={item} suggestedAmount={amount} onDone={jest.fn()} />);
  });
};
const moveButton = () =>
  root.root.findAllByType('Button').find((node: any) => node.props.variant === 'brand');
const texts = (): string[] =>
  root.root
    .findAll((node: any) => node.type === 'Text')
    .flatMap((node: any) => [node.props.children].flat())
    .filter((child: unknown) => typeof child === 'string');

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockCreateSession.mockResolvedValue({ walletAddress: CARD_ADDRESS } as any);
});

afterEach(() => {
  act(() => root?.unmount());
});

describe('WirexMoveAmount', () => {
  it('sends USDC to the user’s rhino.fi wallet address, minting no session', async () => {
    render(holding(polygon.id, 'USDC'), 20);
    expect(mockRhinoAddress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chain: 'MATIC_POS',
        tokenSymbol: 'USDC',
        destinationType: 'WALLET',
      }),
    );

    await act(async () => moveButton().props.onPress());
    expect(mockSend).toHaveBeenCalledWith('20', RHINO_ADDRESS);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  // rhino.fi's wallet route takes USDT too, paying it to the Safe on Base as USDC.
  it('sends USDT to the user’s rhino.fi wallet address, minting no session', async () => {
    render(holding(mainnet.id, 'USDT'), 20);
    expect(mockRhinoAddress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chain: 'ETHEREUM',
        tokenSymbol: 'USDT',
        destinationType: 'WALLET',
      }),
    );

    await act(async () => moveButton().props.onPress());
    expect(mockSend).toHaveBeenCalledWith('20', RHINO_ADDRESS);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  // rhino.fi does not process a deposit under its floor.
  it('will not send less than rhino.fi’s minimum', async () => {
    render(holding(polygon.id, 'USDC'), 2);
    expect(texts().join(' ')).toContain('The minimum on Polygon is 5 USDC');
    expect(moveButton().props.disabled).toBe(true);
  });

  // In the token's own units: an 18-decimal BNB Chain stablecoin a wei under
  // the floor is refused, and one exactly at it is not.
  it('judges an amount at rhino.fi’s minimum exactly, even with 18 decimals', async () => {
    render({ ...holding(bsc.id, 'USDT'), decimals: 18, balance: '100000000000000000000' }, 20);
    const input = root.root.find((node: any) => typeof node.props.onChangeText === 'function');

    act(() => input.props.onChangeText('4.999999999999999999'));
    expect(texts().join(' ')).toContain('The minimum on BNB Chain is 5 USDT');

    act(() => input.props.onChangeText('5'));
    expect(texts().join(' ')).not.toContain('The minimum');
    expect(moveButton().props.disabled).toBe(false);
  });

  // USDC on Base already sits in the Safe on Base rhino.fi would deliver it to.
  it('has nowhere to send USDC already on Base', async () => {
    render(holding(base.id, 'USDC'), 20);
    expect(moveButton().props.disabled).toBe(true);
    await act(async () => moveButton().props.onPress());
    expect(mockSend).not.toHaveBeenCalled();
  });
});
