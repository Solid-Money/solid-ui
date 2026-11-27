import React from 'react';

import RescueToken from '@/app/(protected)/rescue-token';
import { SafeRecoveryAmountChangedError } from '@/lib/utils/safeRecovery';

import type { SafeRecoveryBalance } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * The Rescue tokens screen: funds sent to the user's Solid address on a network the app does
 * not run on get a card of their own, moved with one passkey approval, and the signer-wallet
 * card (USDC on Ethereum) only shows when there is USDC there or nothing else to recover.
 */

const mockReplace = jest.fn();
const mockToastShow = jest.fn();
const mockNetworkRescue = jest.fn();
const mockFailureSheet = jest.fn();
const mockNetwork: {
  current: {
    items: SafeRecoveryBalance[];
    pendingKey: string | null;
  };
} = { current: { items: [], pendingKey: null } };
const mockEoaUsdc = { current: 0n };

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: (...args: unknown[]) => mockToastShow(...args) },
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: 0n, isLoading: false }),
}));
jest.mock('wagmi', () => ({
  useReadContract: () => ({ data: mockEoaUsdc.current, isLoading: false }),
  useBalance: () => ({ data: { value: 0n }, isLoading: false }),
}));
jest.mock('@/assets/images/wallet', () => 'WalletIcon');
jest.mock('@/components/DepositOption/RhinoDeposit/RhinoChainIcon', () => 'RhinoChainIcon');
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/RenderTokenIcon', () => 'RenderTokenIcon');
jest.mock('@/components/Tooltip', () => 'TooltipPopover');
jest.mock('@/components/ui/back-button', () => ({ BackButton: 'BackButton' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/skeleton', () => 'Skeleton');
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/constants/path', () => ({ path: { HOME: '/' } }));
jest.mock('@/hooks/useRescueToken', () => ({
  __esModule: true,
  default: () => ({ rescue: jest.fn(), status: 'idle' }),
}));
jest.mock('@/hooks/useSafeNetworkRescue', () => ({
  __esModule: true,
  default: () => ({
    enabled: true,
    isLoading: false,
    items: mockNetwork.current.items,
    pendingKey: mockNetwork.current.pendingKey,
    rescue: (item: unknown) => mockNetworkRescue(item),
  }),
  safeRecoveryKey: (item: { chainId: number; tokenAddress: string }) =>
    `${item.chainId}:${item.tokenAddress.toLowerCase()}`,
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({
    user: {
      walletAddress: '0x0998aaE29F3Fc1AfDd898800519D6F8cCe5274dF',
      safeAddress: '0xd89fE839283411D033798826FB47960DA5DBcDCf',
    },
  }),
}));
jest.mock('@/lib/assets', () => ({ getAsset: () => 1 }));
jest.mock('@/lib/config', () => ({
  ADDRESSES: { ethereum: { usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' } },
}));
jest.mock('@/lib/errors', () => ({
  showFailureSheet: (...args: unknown[]) => mockFailureSheet(...args),
}));
jest.mock('@/lib/getTokenIcon', () => ({
  __esModule: true,
  default: () => ({ type: 'image', source: 1 }),
}));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
  eclipseAddress: (value: string) => value.slice(0, 6),
  formatNumber: (value: number) => String(value),
}));
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));

const PLASMA_USDT0: SafeRecoveryBalance = {
  chainId: 9745,
  network: 'Plasma',
  safeAddress: '0xd89fE839283411D033798826FB47960DA5DBcDCf',
  tokenAddress: '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb',
  symbol: 'USDT0',
  decimals: 6,
  amount: '10000000',
  amountFormatted: '10',
};

type Node = { type: string; props: Record<string, any>; children: (Node | string)[] };

const textOf = (node: Node | string): string =>
  typeof node === 'string' ? node : node.children.map(textOf).join('');

const render = () => {
  let tree: any;
  act(() => {
    tree = create(<RescueToken />);
  });
  const texts = (tree.root.findAll((n: Node) => n.type === 'Text') as Node[]).map(textOf);
  const buttons = tree.root.findAll((n: Node) => n.type === 'Button') as Node[];
  return { texts, buttons };
};

describe('Rescue tokens screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetwork.current = { items: [], pendingKey: null };
    mockEoaUsdc.current = 0n;
  });

  it('shows a card for funds on another network, and no empty signer-wallet card', () => {
    mockNetwork.current.items = [PLASMA_USDT0];

    const { texts, buttons } = render();

    expect(texts).toContain('Recover USDT0 on Plasma');
    expect(texts).toContain('10 USDT0');
    expect(texts).toContain('Paid by Solid');
    expect(texts).toContain('Move to Solid wallet');
    expect(texts).not.toContain('Recover stuck USDC');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.disabled).toBe(false);
  });

  it('moves the funds on press, then confirms and goes home', async () => {
    mockNetwork.current.items = [PLASMA_USDT0];
    mockNetworkRescue.mockResolvedValue({
      status: 'succeeded',
      transactionHash: '0xabc',
      explorerUrl: 'https://plasmascan.to/tx/0xabc',
    });

    const { buttons } = render();
    await act(async () => {
      await buttons[0].props.onPress();
    });

    expect(mockNetworkRescue).toHaveBeenCalledWith(PLASMA_USDT0);
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        props: { link: 'https://plasmascan.to/tx/0xabc', linkText: '0xabc' },
      }),
    );
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('shows the failure sheet, and stays, when moving fails', async () => {
    mockNetwork.current.items = [PLASMA_USDT0];
    const error = new Error('relay down');
    mockNetworkRescue.mockRejectedValue(error);

    const { buttons } = render();
    await act(async () => {
      await buttons[0].props.onPress();
    });

    expect(mockFailureSheet).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        action: 'rescue_token',
        details: { amount: '10', token: 'USDT0', network: 'Plasma' },
      }),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('asks the user to look again, without the failure sheet, when the amount changed', async () => {
    mockNetwork.current.items = [PLASMA_USDT0];
    mockNetworkRescue.mockRejectedValue(new SafeRecoveryAmountChangedError('20000000'));

    const { buttons } = render();
    await act(async () => {
      await buttons[0].props.onPress();
    });

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'info', text1: 'Balance updated' }),
    );
    expect(mockFailureSheet).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('disables the button while a recovery of that token is on its way', () => {
    mockNetwork.current.items = [
      {
        ...PLASMA_USDT0,
        recovery: {
          id: 'r1',
          chainId: 9745,
          network: 'Plasma',
          tokenAddress: PLASMA_USDT0.tokenAddress,
          symbol: 'USDT0',
          decimals: 6,
          amount: '10000000',
          amountFormatted: '10',
          destinationAddress: '0x08a7a685cb536fff6f21f067a50500fa9df0b3d4',
          status: 'submitted',
          createdAt: '',
          updatedAt: '',
        },
      },
    ];

    const { texts, buttons } = render();

    expect(texts).toContain('On its way');
    expect(buttons[0].props.disabled).toBe(true);
  });

  it('keeps the signer-wallet card when there is nothing on other networks', () => {
    const { texts } = render();

    expect(texts).toContain('Recover stuck USDC');
    expect(texts).not.toContain('Move to Solid wallet');
  });

  it('shows both cards when there is USDC on the signer wallet too', () => {
    mockNetwork.current.items = [PLASMA_USDT0];
    mockEoaUsdc.current = 5_000000n;

    const { texts, buttons } = render();

    expect(texts).toContain('Recover USDT0 on Plasma');
    expect(texts).toContain('Recover stuck USDC');
    expect(buttons).toHaveLength(2);
  });
});
