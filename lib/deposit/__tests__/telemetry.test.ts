/// <reference types="jest" />

import * as Sentry from '@sentry/react-native';

import { captureDepositError } from '@/lib/deposit/telemetry';

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock('@/lib/analytics', () => ({
  track: jest.fn(),
  trackIdentity: jest.fn(),
}));

jest.mock('@/lib/attribution', () => ({
  getAttributionChannel: jest.fn(() => 'organic'),
}));

jest.mock('@/store/useAttributionStore', () => ({
  useAttributionStore: {
    getState: jest.fn(() => ({
      getAttributionForEvent: jest.fn(() => ({})),
    })),
  },
}));

const mockedCaptureException = Sentry.captureException as jest.MockedFunction<
  typeof Sentry.captureException
>;

const ctx = {
  user: { userId: 'u1', safeAddress: '0xabc', suborgId: 'org1' } as any,
  amount: '10',
  depositType: 'solid_wallet' as const,
  depositMethod: 'usdc_solid_base_savings',
  operation: 'deposit_from_solid_usdc',
};

beforeEach(() => {
  mockedCaptureException.mockReset();
});

describe('captureDepositError', () => {
  it('does NOT send to Sentry when the user cancelled the transaction', () => {
    captureDepositError(new Error('User cancelled transaction'), ctx);

    expect(mockedCaptureException).not.toHaveBeenCalled();
  });

  it('DOES send to Sentry for genuine errors', () => {
    captureDepositError(new Error('RPC timeout'), ctx);

    expect(mockedCaptureException).toHaveBeenCalledTimes(1);
  });

  it('returns the user-facing message regardless of whether Sentry fires', () => {
    const msg = captureDepositError(new Error('User cancelled transaction'), ctx);
    expect(msg).toBe('User rejected transaction');
  });
});
