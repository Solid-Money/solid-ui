import React from 'react';

import SwapButton from '@/components/Swap/SwapButton';
import { SWAP_MODAL } from '@/constants/modals';
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/assets/images/info-error', () => 'InfoError');
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/assets', () => ({ getAsset: () => 1 }));
jest.mock('@/lib/utils/swap/prices', () => ({
  warningSeverity: () => 0,
  computeRealizedLPFeePercent: () => ({}),
}));
jest.mock('@cryptoalgebra/fuse-sdk', () => ({ tryParseAmount: () => undefined }));
jest.mock('@/store/userStore', () => ({ useUserState: () => ({ isExpertMode: false }) }));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: { userId: 'a' } }),
}));
jest.mock('@/store/useRewardsUpgradeStore', () => ({
  selectedRewardsUserId: () => mockUser,
  useRewardsUpgradeStore: { getState: () => ({ session: mockSession }) },
}));
jest.mock('@/store/swapStore', () => ({
  useSwapState: (selector: any) =>
    selector({
      independentField: 'INPUT',
      typedValue: '100',
      actions: { resetForm: mockReset, setModal: mockSetModal, setTransaction: mockSetTransaction },
    }),
  useDerivedSwapInfo: () => ({
    tradeState: { state: mockRouteState },
    inputError: mockInputError,
    toggledTrade: mockHasTrade ? mockTrade : undefined,
    parsedAmount: mockAmount,
    currencies: {
      INPUT: { symbol: 'USDC', wrapped: { address: '0x1' } },
      OUTPUT: { symbol: 'FUSE', wrapped: { address: '0x2' } },
    },
    allowedSlippage: { toSignificant: () => '0.5' },
    voltageTrade: {},
    isVoltageTrade: false,
  }),
}));
jest.mock('@/hooks/swap/useSwapCallback', () => ({
  useSwapCallback: (_trade: any, _slippage: any, info: any) => {
    mockInfo = info;
    return {
      callback: mockCallbackAvailable ? mockExecute : undefined,
      error: mockCallbackAvailable ? undefined : 'Unable to prepare the quote. Try another amount.',
      isLoading: false,
      needAllowance: false,
    };
  },
}));
jest.mock('@/hooks/swap/useVoltageSwapCallback', () => ({ useVoltageSwapCallback: () => ({}) }));
jest.mock('@/hooks/swap/usePegswapCallback', () => ({
  __esModule: true,
  PegSwapType: { NOT_APPLICABLE: 'none' },
  default: () => ({ pegSwapType: 'none' }),
}));
jest.mock('@/hooks/swap/useWrapCallback', () => ({
  __esModule: true,
  WrapType: { NOT_APPLICABLE: 'none' },
  default: () => ({ wrapType: 'none' }),
}));
const mockSetModal = jest.fn(),
  mockSetTransaction = jest.fn(),
  mockReset = jest.fn(),
  mockExecute = jest.fn();
let mockInfo: any,
  mockInputError: string | undefined,
  mockUser = 'a',
  mockSession = 0,
  mockRouteState = 'VALID',
  mockHasTrade = true,
  mockCallbackAvailable = true;
const mockAmount = { toSignificant: () => '100', greaterThan: () => true };
const mockTrade = {
  swaps: [{}],
  inputAmount: mockAmount,
  outputAmount: mockAmount,
  priceImpact: { subtract: () => 0 },
};
let root: any;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockUser = 'a';
  mockSession = 0;
  mockRouteState = 'VALID';
  mockHasTrade = true;
  mockCallbackAvailable = true;
  mockInputError = undefined;
});
afterEach(() => act(() => root.unmount()));
const mount = (props: any = {}) =>
  act(() => {
    root = create(<SwapButton {...props} />);
  });
const press = () => root.root.findByType('Button').props.onPress();
it('preserves ordinary swap completion and deduplicates repeated receipt callbacks', async () => {
  mockExecute.mockImplementation(async () => {
    mockInfo.onSuccess();
    mockInfo.onSuccess();
  });
  mount();
  await act(async () => {
    await press();
  });
  expect(mockSetModal).toHaveBeenCalledTimes(1);
  expect(mockSetModal).toHaveBeenCalledWith(SWAP_MODAL.OPEN_TRANSACTION_STATUS);
  expect(mockReset).toHaveBeenCalledTimes(1);
});
it('uses the Savings handoff only for a confirmed Buy FUSE swap', async () => {
  const confirmed = jest.fn();
  mockExecute.mockImplementation(async () => {
    mockInfo.onSuccess();
    mockInfo.onSuccess();
  });
  mount({ onConfirmed: confirmed });
  await act(async () => {
    await press();
  });
  expect(confirmed).toHaveBeenCalledTimes(1);
  expect(mockSetModal).not.toHaveBeenCalled();
});
it('does not hand off a cancelled or failed swap', async () => {
  const confirmed = jest.fn();
  mockExecute.mockResolvedValue(undefined);
  mount({ onConfirmed: confirmed });
  await act(async () => {
    await press();
  });
  expect(confirmed).not.toHaveBeenCalled();
  mockExecute.mockRejectedValue(new Error('reverted'));
  await act(async () => {
    await press();
  });
  expect(confirmed).not.toHaveBeenCalled();
});
it('blocks double submission while the original swap is running', async () => {
  let finish!: () => void;
  mockExecute.mockReturnValue(
    new Promise<void>(resolve => {
      finish = resolve;
    }),
  );
  mount();
  await act(async () => {
    const first = press();
    await press();
    finish();
    await first;
  });
  expect(mockExecute).toHaveBeenCalledTimes(1);
});
it('blocks disabled or stale upgrade submissions', async () => {
  mount({ disabled: true });
  expect(root.root.findByType('Button').props.disabled).toBe(true);
  await act(async () => {
    await press();
  });
  expect(mockExecute).not.toHaveBeenCalled();
});
it('ignores completion after an account switch, including a switch back', async () => {
  const confirmed = jest.fn();
  mockExecute.mockImplementation(async () => {
    mockSession++;
    mockInfo.onSuccess();
  });
  mount({ onConfirmed: confirmed });
  await act(async () => {
    await press();
  });
  expect(confirmed).not.toHaveBeenCalled();
  expect(mockSetModal).not.toHaveBeenCalled();
});

it('disables Buy FUSE and explains when the quote cannot be executed', () => {
  mockCallbackAvailable = false;
  mount({ label: 'Buy FUSE' });
  expect(root.root.findByType('Button').props.disabled).toBe(true);
  expect(JSON.stringify(root.toJSON())).toContain(
    'Unable to prepare the quote. Try another amount.',
  );
});

it('does not enable Buy FUSE when no route was found and the trade is absent', () => {
  mockRouteState = 'NO_ROUTE_FOUND';
  mockHasTrade = false;
  mockCallbackAvailable = false;
  mount({ label: 'Buy FUSE' });
  expect(root.root.findByType('Button').props.disabled).toBe(true);
  expect(JSON.stringify(root.toJSON())).toContain(
    'We couldn’t get a price. Try a different amount.',
  );
});

it('prioritizes insufficient funds over an unavailable price', () => {
  mockInputError = 'Not enough USDC on Fuse. Add funds to continue.';
  mockRouteState = 'NO_ROUTE_FOUND';
  mockHasTrade = false;
  mockCallbackAvailable = false;
  mount({ label: 'Buy FUSE' });
  expect(root.root.findByType('Button').props.disabled).toBe(true);
  expect(JSON.stringify(root.toJSON())).toContain(mockInputError);
  expect(JSON.stringify(root.toJSON())).not.toContain('We couldn’t get a price');
});

it.each(['LOADING', 'SYNCING'])('shows quote progress while the route is %s', state => {
  mockRouteState = state;
  mount({ label: 'Buy FUSE' });
  expect(root.root.findByType('Button').props.disabled).toBe(true);
  expect(JSON.stringify(root.toJSON())).toContain('Finding Routes...');
});

it('shows a rejected purchase on screen and lets the user retry', async () => {
  mockExecute.mockRejectedValueOnce(new Error('Wallet confirmation failed. Please try again.'));
  mount({ label: 'Buy FUSE' });
  await act(async () => {
    await press();
  });
  expect(JSON.stringify(root.toJSON())).toContain('Wallet confirmation failed. Please try again.');
  expect(root.root.findByType('Button').props.disabled).toBe(false);
  mockExecute.mockResolvedValueOnce(undefined);
  await act(async () => {
    await press();
  });
  expect(JSON.stringify(root.toJSON())).not.toContain(
    'Wallet confirmation failed. Please try again.',
  );
});

it('shows progress immediately while wallet confirmation is pending', async () => {
  let finish!: () => void;
  mockExecute.mockReturnValue(
    new Promise<void>(resolve => {
      finish = resolve;
    }),
  );
  mount({ label: 'Buy FUSE' });
  let pending!: Promise<void>;
  await act(async () => {
    pending = press();
  });
  expect(root.root.findByType('Button').props.disabled).toBe(true);
  expect(JSON.stringify(root.toJSON())).toContain('Processing Transaction...');
  await act(async () => {
    finish();
    await pending;
  });
});
