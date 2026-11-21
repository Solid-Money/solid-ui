import React from 'react';

import WirexCardFundModal from '@/components/Card/WirexCardFundModal';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { CardProvider } from '@/lib/types';
import { useWalletTopUpStore } from '@/store/useWalletTopUpStore';

import type { WalletTopUpQuoteResponse } from '@/lib/types/wallet-topup';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * "Fund your card" for a Wirex cardholder, closed with a top-up under way: the
 * next open starts from the options with no quote (or checkout token) kept,
 * whether the modal closed itself or its parent closed it.
 */

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@tanstack/react-query', () => ({ useMutation: () => ({ mutate: jest.fn() }) }));
jest.mock('@/components/BuyCrypto/Transfi/BuyCryptoFlow', () => ({
  BuyCryptoFlowContent: 'BuyCryptoFlowContent',
}));
jest.mock('@/components/Card/CardFund/CardFundDepositAddress', () => 'CardFundDepositAddress');
jest.mock('@/components/Card/CardFund/CardFundNetworks', () => 'CardFundNetworks');
jest.mock('@/components/Card/CardFund/CardFundOptions', () => 'CardFundOptions');
// Not the real module: its sections come from `lib/utils/cardFunding`, whose
// import graph reaches wagmi's ESM build, which jest-expo does not transform.
jest.mock('@/components/Card/CardFund/constants', () => ({
  CARD_FUND_DESTINATION_TYPE: 'CARD',
  CARD_FUND_MOVE_COPY: { wirex: { title: 'Move from wallet' } },
  getCardFundRhinoDestination: () => 'WALLET',
  getCardFundTokenIcon: (symbol: string) => symbol,
  WIREX_CARD_FUND_SECTIONS: [],
  WIREX_CARD_FUND_TOKENS: [],
}));
jest.mock('@/components/Card/CardFund/WirexMoveFromWallet', () => ({
  useMovableHoldings: () => ({
    holdings: [],
    swappable: [],
    isLoading: false,
    isRhinoUnavailable: false,
    retryRhino: jest.fn(),
  }),
  WirexMoveAmount: 'WirexMoveAmount',
  WirexMoveHoldings: 'WirexMoveHoldings',
}));
jest.mock(
  '@/components/DepositOption/RhinoDeposit/RhinoDepositAddress',
  () => 'RhinoDepositAddress',
);
jest.mock('@/components/ResponsiveModal', () => ({ __esModule: true, default: 'ResponsiveModal' }));
jest.mock('@/components/WalletTopUp/WalletTopUpFlow', () => ({
  WalletTopUpFlowContent: 'WalletTopUpFlowContent',
}));
jest.mock('@/components/WalletTopUp/WalletTopUpProbe', () => 'WalletTopUpProbe');
jest.mock('@/hooks/useBuyCryptoEntry', () => ({
  useBuyCryptoEntry: () => ({ handleBuyCryptoPress: jest.fn() }),
}));
// The row's tap opens the top-up's first step; the test taps it through `open`.
jest.mock('@/hooks/useCanWalletTopUp', () => ({
  useWalletTopUpEntry: (_source: string, open: () => void) => {
    mockOpenWalletTopUp.current = open;
    return { visible: true, method: 'apple_pay', needsCard: false, onPress: open };
  },
}));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: mockProvider }),
}));
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => ({ status: 'ready', assets: [] }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/api', () => ({ createDirectDepositSession: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (call: () => unknown) => call() }));
jest.mock('@/store/swapStore', () => ({ useSwapState: { getState: () => ({ actions: {} }) } }));
jest.mock('@/store/useTransfiStore', () => ({
  useTransfiStore: (selector: (state: any) => unknown) =>
    selector({ reset: jest.fn(), setFiatCurrency: jest.fn() }),
}));

const mockProvider = CardProvider.WIREX;
const mockOpenWalletTopUp: { current: (() => void) | null } = { current: null };

const QUOTE = {
  estimationId: 'est-1',
  checkoutToken: 'token-1',
  quote: { destinationAmount: { amount: '100.00', currency: 'USDC' } },
} as unknown as WalletTopUpQuoteResponse;

let root: any;
const modal = () => root.root.findByType('ResponsiveModal').props;

/** Opens the top-up from the options and leaves it at review, with a live quote. */
const startTopUp = () => {
  act(() => mockOpenWalletTopUp.current?.());
  const store = useWalletTopUpStore.getState();
  store.start('apple_pay', 'card_fund');
  store.setAmount('100');
  store.setQuote(QUOTE);
  expect(modal().contentKey).toBe(DEPOSIT_MODAL.OPEN_WALLET_TOPUP_AMOUNT.name);
  expect(useWalletTopUpStore.getState().quote).toBe(QUOTE);
};

const expectReset = () => {
  expect(useWalletTopUpStore.getState()).toMatchObject({ quote: null, amount: '' });
  expect(modal().contentKey).toBe('options');
  expect(root.root.findAllByType('WalletTopUpFlowContent')).toHaveLength(0);
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mockOpenWalletTopUp.current = null;
  useWalletTopUpStore.getState().reset();
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
});

it('resets the top-up when the parent closes the controlled modal', () => {
  const onOpenChange = jest.fn();
  act(() => {
    root = create(<WirexCardFundModal isOpen onOpenChange={onOpenChange} />);
  });
  startTopUp();

  act(() => root.update(<WirexCardFundModal isOpen={false} onOpenChange={onOpenChange} />));
  expectReset();
  expect(onOpenChange).not.toHaveBeenCalled();

  act(() => root.update(<WirexCardFundModal isOpen onOpenChange={onOpenChange} />));
  expect(modal().contentKey).toBe('options');
});

it('resets the top-up when the modal closes itself', () => {
  act(() => {
    root = create(<WirexCardFundModal />);
  });
  act(() => modal().onOpenChange(true));
  startTopUp();

  act(() => modal().onOpenChange(false));
  expect(modal().isOpen).toBe(false);
  expectReset();
});

it('leaves a top-up alone when a closed instance mounts', () => {
  // The deposit modal's own top-up, running when a closed card modal mounts.
  useWalletTopUpStore.getState().start('apple_pay', 'deposit');
  useWalletTopUpStore.getState().setQuote(QUOTE);

  act(() => {
    root = create(<WirexCardFundModal isOpen={false} onOpenChange={jest.fn()} />);
  });

  expect(useWalletTopUpStore.getState().quote).toBe(QUOTE);
});
