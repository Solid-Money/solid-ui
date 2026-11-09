import { ERRORS } from '@/constants/errors';
import { depositErrorMessage } from '@/lib/deposit/telemetry';
import { WalletLinkError } from '@/lib/deposit/walletLinkError';

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn(), trackIdentity: jest.fn() }));
jest.mock('@/lib/attribution', () => ({ getAttributionChannel: jest.fn() }));
jest.mock('@/store/useAttributionStore', () => ({
  useAttributionStore: { getState: () => ({}) },
}));

describe('depositErrorMessage', () => {
  it('shows why linking the wallet failed', () => {
    expect(
      depositErrorMessage(new WalletLinkError('Smart contract wallets cannot be linked yet.')),
    ).toBe('Smart contract wallets cannot be linked yet.');
  });

  it('still shows nothing for an error it does not recognise', () => {
    expect(depositErrorMessage(new Error('execution reverted: 0x1234'))).toBe('');
  });

  it('keeps the existing mappings', () => {
    expect(depositErrorMessage(new Error('User rejected the request.'))).toBe(
      'User rejected transaction',
    );
    expect(depositErrorMessage(new Error(`${ERRORS.ERROR_SWITCHING_CHAIN}: boom`))).toBe(
      ERRORS.ERROR_SWITCHING_CHAIN,
    );
  });
});
