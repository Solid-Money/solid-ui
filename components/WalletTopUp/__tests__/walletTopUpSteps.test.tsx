import React from 'react';
import { TextInput } from 'react-native';

import { WalletTopUpAmount } from '@/components/WalletTopUp/WalletTopUpAmount';
import { WalletTopUpReview } from '@/components/WalletTopUp/WalletTopUpReview';
import { useWalletTopUpStore } from '@/store/useWalletTopUpStore';

import type {
  WalletTopUpAvailability,
  WalletTopUpQuoteResponse,
  WalletTopUpSdkConfig,
} from '@/lib/types/wallet-topup';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * The amount and review steps of the Apple Pay / Google Pay top-up: the amount
 * holds still while it is being priced, and the review never goes blank under a
 * quote it holds.
 */

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('lucide-react-native', () => ({ ChevronDown: 'ChevronDown' }));
jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock('@/components/NeedHelp', () => 'NeedHelp');
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/WalletTopUp/WalletCheckout', () => 'WalletCheckout');
jest.mock('@/components/WalletTopUp/WalletTopUpNavigation', () => ({
  useWalletTopUpNavigation: () => mockNavigate,
}));
jest.mock('@/hooks/useWalletTopUp', () => ({
  useCreateWalletTopUpQuote: () => mockQuote,
  useWalletTopUpStatus: () => ({ data: undefined }),
}));
jest.mock('@/hooks/useWalletTopUpAvailability', () => ({
  useWalletTopUpAvailability: () => mockAvailability.current,
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));

const SDK: WalletTopUpSdkConfig = {
  webEnvironment: 'uat',
  mobileEnvironment: 'test',
  clientId: null,
};

const AVAILABILITY: WalletTopUpAvailability = {
  available: true,
  reason: 'ok',
  capabilityStatus: 'Active',
  sdk: SDK,
  provider: 'checkout',
  walletConfig: { apple_pay: {} },
  currencies: ['USD', 'EUR'],
  defaultCurrency: 'USD',
  limits: { USD: { min: '10.00', max: '500.00' }, EUR: { min: '10.00', max: '500.00' } },
  payoutTokens: { USD: 'USDC', EUR: 'EURC' },
};

const QUOTE: WalletTopUpQuoteResponse = {
  estimationId: 'est-1',
  provider: 'checkout',
  walletConfig: { apple_pay: {} },
  checkoutToken: 'token-1',
  checkoutTokenExpiresAt: 1_700_000_000,
  quote: {
    estimationId: 'est-1',
    sourceAmount: { amount: '101.50', currency: 'USD' },
    destinationAmount: { amount: '100.00', currency: 'USDC' },
    fee: null,
    rate: null,
    expiresAtMs: 1_700_000_000_000,
  },
  payout: { token: 'USDC', chainId: 8453, amount: '100.00' },
};

const mockNavigate = jest.fn();
const mockQuote = { mutate: jest.fn(), isPending: false };
const mockRefetch = jest.fn(async () => undefined);
const mockAvailability: { current: ReturnType<typeof availabilityResult> } = {
  current: undefined as any,
};

const availabilityResult = (checkoutSdk: WalletTopUpSdkConfig | undefined) => ({
  availability: checkoutSdk ? AVAILABILITY : undefined,
  isAvailable: !!checkoutSdk,
  isLoading: false,
  checkoutSdk,
  refetch: mockRefetch,
});

let root: any;
const render = (element: React.ReactElement) => {
  act(() => {
    root = create(element);
  });
};

const texts = () =>
  root.root
    .findAll((node: any) => node.type === 'Text' && typeof node.props.children === 'string')
    .map((node: any) => node.props.children);

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockQuote.isPending = false;
  mockAvailability.current = availabilityResult(SDK);
  useWalletTopUpStore.getState().reset();
  useWalletTopUpStore.getState().start('apple_pay', 'deposit');
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
});

describe('WalletTopUpAmount', () => {
  const amountInput = () => root.root.findByType(TextInput);
  const currencyButton = () =>
    root.root.findAllByProps({ accessibilityLabel: 'Get USDC. Change currency' })[0];

  it('takes an amount and a currency while nothing is being priced', () => {
    useWalletTopUpStore.getState().setAmount('100');
    render(<WalletTopUpAmount />);

    expect(amountInput().props.editable).toBe(true);
    expect(currencyButton().props.disabled).toBe(false);
  });

  it('holds the amount and the currency while the quote is on its way', () => {
    useWalletTopUpStore.getState().setAmount('100');
    mockQuote.isPending = true;
    render(<WalletTopUpAmount />);

    expect(amountInput().props.editable).toBe(false);
    expect(currencyButton().props.disabled).toBe(true);
  });
});

describe('WalletTopUpReview', () => {
  beforeEach(() => {
    useWalletTopUpStore.getState().setCurrency('USD');
    useWalletTopUpStore.getState().setAmount('100');
    useWalletTopUpStore.getState().setQuote(QUOTE);
  });

  it('shows the checkout with the SDK config it was loaded with', () => {
    render(<WalletTopUpReview />);

    expect(root.root.findByType('WalletCheckout').props.sdk).toBe(SDK);
    expect(texts()).toContain('100.00 USDC');
  });

  it('says so, with a retry, rather than going blank when there is no SDK config', () => {
    mockAvailability.current = availabilityResult(undefined);
    render(<WalletTopUpReview />);

    expect(root.root.findAllByType('WalletCheckout')).toHaveLength(0);
    expect(texts()).toContain("We couldn't load Apple Pay right now.");

    act(() => root.root.findByType('Button').props.onPress());
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockQuote.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '100.00', currency: 'USD', paymentMethod: 'apple_pay' }),
      expect.anything(),
    );
  });

  it('hides the checkout while a fresh quote is on its way, so the old one cannot be paid', () => {
    mockQuote.isPending = true;
    render(<WalletTopUpReview />);

    expect(root.root.findAllByType('WalletCheckout')).toHaveLength(0);
    expect(texts()).toContain('Getting a new price…');
  });

  it('keeps the error until the new quote is in, then shows the checkout again', () => {
    render(<WalletTopUpReview />);
    act(() => root.root.findByType('WalletCheckout').props.handlers.onLoadFailed('timeout'));
    expect(texts()).toContain("We couldn't load Apple Pay right now.");

    act(() => root.root.findByType('Button').props.onPress());
    // Still on the error, not on a checkout for the old quote.
    expect(texts()).toContain("We couldn't load Apple Pay right now.");
    expect(root.root.findAllByType('WalletCheckout')).toHaveLength(0);

    const [, { onSuccess }] = mockQuote.mutate.mock.calls[0];
    act(() => onSuccess(QUOTE));
    expect(texts()).not.toContain("We couldn't load Apple Pay right now.");
    expect(root.root.findAllByType('WalletCheckout')).toHaveLength(1);
  });
});
