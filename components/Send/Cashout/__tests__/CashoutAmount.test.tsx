import React from 'react';
import { parseUnits } from 'viem';

import { CashoutAmount } from '@/components/Send/Cashout/CashoutAmount';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/lib/assets', () => ({ getAsset: () => 1 }));
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
  formatNumber: (value: number) => String(value),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ fetchQuery: mockState.fetchQuery }),
}));
jest.mock('@/hooks/useDebounce', () => ({ __esModule: true, default: (value: unknown) => value }));
jest.mock('@/hooks/useCashout', () => ({
  useCashoutUsdc: () => ({ balanceWei: mockState.balanceWei, decimals: 6, isLoading: false }),
}));
jest.mock('@/lib/utils/cross-chain-send', () => ({
  formatLD: (amountLD: string) => jest.requireActual('viem').formatUnits(BigInt(amountLD), 6),
}));
jest.mock('@/hooks/useCashoutBridge', () => ({
  bridgePlanMessage: (error: Error) => error.message,
  cashoutBridgeMaxQuery: () => ({ queryKey: ['max'] }),
  useCashoutBridge: () => ({ source: mockState.bridge, isLoading: false }),
  useCashoutBridgePlan: (_chainId: number, shortfallLD: bigint) => {
    mockState.planned.push(shortfallLD);
    return { data: mockState.plan, isFetching: false, error: mockState.planError ?? null };
  },
}));
jest.mock('@/hooks/useTransfiCashout', () => ({
  cashoutQuoteQuery: jest.fn(),
  useTransfiCashoutConfig: () => ({ data: { tokenNetwork: 'Base', chainId: 8453 } }),
  useTransfiCashoutLimits: () => ({ data: mockState.limits, isLoading: mockState.limitsLoading }),
  useTransfiCashoutQuote: (amount: string, _c: string, _p: string, enabled: boolean) => {
    mockState.quotedWhileValid.push({ amount, enabled });
    return { data: mockState.quote, isFetching: false, error: null };
  },
}));
jest.mock('@/store/useSendStore', () => ({
  useSendStore: (selector: (state: any) => unknown) => selector({ setModal: jest.fn() }),
}));
jest.mock('@/store/useCashoutStore', () => ({
  useCashoutStore: (selector: (state: any) => unknown) =>
    selector({
      currency: 'ZMW',
      paymentCode: 'zm_mobile_money',
      usdcAmount: mockState.amount,
      setUsdcAmount: mockState.setAmount,
    }),
}));

const LIMITS = { minLimit: 26.256445, maxLimit: 100019.160769 };

const mockState: {
  amount: string;
  balanceWei: bigint;
  limits?: typeof LIMITS;
  limitsLoading: boolean;
  quote?: Record<string, unknown>;
  setAmount: jest.Mock;
  quotedWhileValid: { amount: string; enabled: boolean }[];
  fetchQuery: jest.Mock;
  bridge?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  planError?: Error;
  planned: bigint[];
} = {
  amount: '',
  balanceWei: 0n,
  limitsLoading: false,
  setAmount: jest.fn(),
  quotedWhileValid: [],
  fetchQuery: jest.fn(),
  planned: [],
};

/** 1,250 USDC on Fuse the bridge can move to Base. */
const FUSE_SOURCE = {
  balanceWei: parseUnits('1250', 6),
  minLD: parseUnits('5', 6),
  cap: { amountLD: parseUnits('1250', 6), reason: 'balance' },
  networkName: 'Base',
  etaMinutes: 2,
};

const QUOTE_100 = {
  usdcAmount: '100',
  fiatCurrency: 'ZMW',
  paymentCode: 'zm_mobile_money',
  fiatAmount: 2400,
  totalFee: 12,
  ...LIMITS,
};

const render = () => {
  let root: any;
  act(() => {
    root = create(<CashoutAmount />);
  });
  return root;
};

/** Every string rendered inside <Text>, in order. */
const texts = (root: any): string[] =>
  root.root
    .findAll((node: any) => node.type === 'Text')
    .map((node: any) => [node.props.children].flat().join(''));

const rowValue = (root: any, label: string): any => {
  const all = root.root.findAll((node: any) => node.type === 'Text');
  const index = all.findIndex((node: any) => node.props.children === label);
  return index >= 0 ? all[index + 1] : undefined;
};

const maxButton = (root: any) =>
  root.root.find((node: any) => node.props.accessibilityLabel === 'Use maximum amount');
const reviewButton = (root: any) => root.root.find((node: any) => node.type === 'Button');
const amountField = (root: any) =>
  root.root.find((node: any) => node.props.accessibilityLabel === 'USDC amount');

beforeEach(() => {
  mockState.amount = '';
  mockState.balanceWei = parseUnits('500', 6);
  mockState.limits = LIMITS;
  mockState.limitsLoading = false;
  mockState.quote = undefined;
  mockState.setAmount = jest.fn();
  mockState.quotedWhileValid = [];
  mockState.fetchQuery = jest.fn();
  mockState.bridge = undefined;
  mockState.plan = undefined;
  mockState.planError = undefined;
  mockState.planned = [];
});

describe('CashoutAmount', () => {
  it('shows the method’s limits under Rate and Fees', () => {
    const root = render();
    const lines = texts(root);
    expect(lines.indexOf('Limits')).toBeGreaterThan(lines.indexOf('Fees'));
    expect(rowValue(root, 'Limits').props.children).toBe('26.26 – 100,019.16 USDC per cash-out');
    expect(lines).toContain(
      'Cash-outs are provided by TransFi. Rates, fees and limits are set by TransFi and may change.',
    );
  });

  it('shows a dash while the limits load, and no row when they failed', () => {
    mockState.limits = undefined;
    mockState.limitsLoading = true;
    expect(rowValue(render(), 'Limits').props.children).toBe('—');

    mockState.limitsLoading = false;
    expect(texts(render())).not.toContain('Limits');
  });

  it('puts an amount below the minimum on the field, not in a quote', () => {
    mockState.amount = '10';
    const root = render();
    const lines = texts(root);

    expect(lines).toContain('The minimum cash-out is 26.26 USDC');
    expect(lines).not.toContain('Sent from your wallet on Base');
    expect(lines).toContain('— ZMW');
    expect(rowValue(root, 'Fees').props.children).toBe('—');
    expect(rowValue(root, 'Limits').props.className).toContain('text-warning');
    expect(amountField(root).props.accessibilityHint).toBe('The minimum cash-out is 26.26 USDC');
    expect(reviewButton(root).props.disabled).toBe(true);
    // Never quoted: TransFi would only refuse it.
    expect(mockState.quotedWhileValid.every(call => !call.enabled)).toBe(true);
  });

  it('keeps the limits row neutral for a balance problem', () => {
    mockState.amount = '600';
    const root = render();
    expect(texts(root)).toContain('That’s more than your balance');
    expect(rowValue(root, 'Limits').props.className).not.toContain('text-warning');
  });

  it('says a balance under the minimum as soon as it opens, and disables Max', () => {
    mockState.balanceWei = parseUnits('20', 6);
    const root = render();
    expect(texts(root)).toContain('You need at least 26.26 USDC to cash out');
    expect(maxButton(root).props.disabled).toBe(true);
  });

  it('fills the maximum, not the balance, when the balance is above it', () => {
    mockState.balanceWei = parseUnits('150000', 6);
    const root = render();
    act(() => maxButton(root).props.onPress());
    expect(mockState.setAmount).toHaveBeenCalledWith('100019.160769');
  });

  it('fills the balance when it is below the maximum', () => {
    const root = render();
    act(() => maxButton(root).props.onPress());
    expect(mockState.setAmount).toHaveBeenCalledWith('500');
  });

  it('enables Review for an amount inside the limits with its quote', () => {
    mockState.amount = '100';
    mockState.quote = {
      usdcAmount: '100',
      fiatCurrency: 'ZMW',
      paymentCode: 'zm_mobile_money',
      fiatAmount: 2400,
      totalFee: 12,
      ...LIMITS,
    };
    const root = render();
    expect(texts(root)).toContain('Sent from your wallet on Base');
    expect(reviewButton(root).props.disabled).toBe(false);
    expect(amountField(root).props.accessibilityHint).toBeUndefined();
  });

  it('checks only the balance when the limits are unavailable', () => {
    mockState.limits = undefined;
    mockState.amount = '1';
    const root = render();
    expect(texts(root)).toContain('Sent from your wallet on Base');
    expect(mockState.quotedWhileValid.at(-1)).toEqual({ amount: '1', enabled: true });
  });

  describe('with USDC on Fuse', () => {
    beforeEach(() => {
      mockState.balanceWei = parseUnits('12.4', 6);
      mockState.bridge = FUSE_SOURCE;
    });

    it('counts Base and Fuse in one balance, and shows the split', () => {
      const root = render();
      expect(texts(root)).toContain('Balance 1262.4 USDC');
      expect(rowValue(root, 'On Base').props.children).toBe('12.4 USDC');
      expect(rowValue(root, 'On Fuse').props.children).toBe('1250 USDC');
    });

    it('sends from Base alone when Base covers the amount', () => {
      mockState.amount = '10';
      mockState.limits = undefined;
      const root = render();
      expect(texts(root)).toContain('Sent from your wallet on Base');
      expect(mockState.planned.every(shortfall => shortfall === 0n)).toBe(true);
    });

    it('prices the shortfall from Fuse and enables Review once it is priced', () => {
      mockState.amount = '100';
      mockState.quote = QUOTE_100;
      mockState.plan = { amountLD: '88000000', amountReceivedLD: '87600000', totalFeeLD: '400000' };
      const root = render();
      expect(mockState.planned.at(-1)).toBe(parseUnits('87.6', 6));
      expect(texts(root)).toContain('87.6 USDC moves from Fuse to Base first. Takes about 2 min.');
      expect(reviewButton(root).props.disabled).toBe(false);
    });

    it('holds Review until the move is priced', () => {
      mockState.amount = '100';
      mockState.quote = QUOTE_100;
      expect(reviewButton(render()).props.disabled).toBe(true);
    });

    it('puts a move that can’t be made on the field', () => {
      mockState.amount = '100';
      mockState.quote = QUOTE_100;
      mockState.planError = new Error('That’s over today’s limit for moving USDC from Fuse');
      const root = render();
      expect(texts(root)).toContain('That’s over today’s limit for moving USDC from Fuse');
      expect(reviewButton(root).props.disabled).toBe(true);
    });

    it('fills Max with the Base balance plus what the move from Fuse would land', async () => {
      mockState.limits = undefined;
      mockState.fetchQuery.mockResolvedValue({ amountReceivedLD: parseUnits('1249.6', 6) });
      const root = render();
      await act(async () => maxButton(root).props.onPress());
      expect(mockState.setAmount).toHaveBeenCalledWith('1262');
    });

    it('fills Max with the Base balance when the move can’t be priced', async () => {
      mockState.limits = undefined;
      mockState.fetchQuery.mockRejectedValue(new Error('down'));
      const root = render();
      await act(async () => maxButton(root).props.onPress());
      expect(mockState.setAmount).toHaveBeenCalledWith('12.4');
    });
  });
});
