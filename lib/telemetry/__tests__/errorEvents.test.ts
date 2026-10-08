/// <reference types="jest" />

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import {
  inferErrorFlow,
  isErrorEvent,
  reportFlowError,
  toFlowErrorReport,
} from '@/lib/telemetry/errorEvents';
import { reportError } from '@/lib/telemetry/reportError';

jest.mock('@/lib/telemetry/reportError', () => ({ reportError: jest.fn() }));

const mockReportError = reportError as jest.MockedFunction<typeof reportError>;

describe('isErrorEvent', () => {
  it.each([
    TRACKING_EVENTS.DEPOSIT_ERROR,
    TRACKING_EVENTS.CARD_ACTIVATION_FAILED,
    TRACKING_EVENTS.BUY_CRYPTO_KYC_REJECTED,
    TRACKING_EVENTS.ONRAMPER_KYC_SHARE_DECLINED,
    TRACKING_EVENTS.VIRTUAL_ACCOUNT_REGION_BLOCKED,
    TRACKING_EVENTS.BUY_CRYPTO_KYC_HOSTED_RETRY_UNAVAILABLE,
    TRACKING_EVENTS.ERROR_BOUNDARY,
    TRACKING_EVENTS.REGION_UNAVAILABLE_SHOWN,
    TRACKING_EVENTS.QR_SCANNER_PERMISSION_DENIED,
    TRACKING_EVENTS.LOGIN_FAILED,
  ])('treats %s as an error', name => {
    expect(isErrorEvent(name)).toBe(true);
  });

  it.each([
    TRACKING_EVENTS.DEPOSIT_CANCELLED,
    TRACKING_EVENTS.DEPOSIT_COMPLETED,
    TRACKING_EVENTS.BUY_CRYPTO_ERROR_VIEWED,
    TRACKING_EVENTS.ORCHESTRA_ERROR_ACTION_PRESSED,
    TRACKING_EVENTS.CARD_SPEND_REGISTER_CANCELLED,
    TRACKING_EVENTS.STORE_REVIEW_UNAVAILABLE,
    TRACKING_EVENTS.TRUSTPILOT_WIDGET_UNAVAILABLE,
    TRACKING_EVENTS.RETRY_ATTEMPTED,
    'ATT_Response',
    '',
  ])('does not treat %p as an error', name => {
    expect(isErrorEvent(name)).toBe(false);
  });

  it('every *_failed and *_error constant is an error event', () => {
    const failures = Object.values(TRACKING_EVENTS).filter(
      name => name.endsWith('_failed') || name.endsWith('_error'),
    );
    expect(failures.length).toBeGreaterThan(30);
    failures.forEach(name => expect(isErrorEvent(name)).toBe(true));
  });
});

describe('inferErrorFlow', () => {
  it.each([
    [TRACKING_EVENTS.DEPOSIT_ERROR, 'deposit'],
    [TRACKING_EVENTS.CARD_DEPOSIT_FAILED, 'card_deposit'],
    [TRACKING_EVENTS.CARD_ACTIVATION_FAILED, 'card'],
    [TRACKING_EVENTS.CARD_KYC_COUNTRY_DETECTION_FAILED, 'kyc'],
    [TRACKING_EVENTS.KYC_LINK_ERROR, 'kyc'],
    [TRACKING_EVENTS.WITHDRAW_TRANSACTION_ERROR, 'withdraw'],
    [TRACKING_EVENTS.FAST_WITHDRAW_FAILED, 'withdraw'],
    [TRACKING_EVENTS.CANCEL_WITHDRAW_ERROR, 'withdraw'],
    [TRACKING_EVENTS.SEND_PAGE_TRANSACTION_FAILED, 'send'],
    [TRACKING_EVENTS.SWAP_FAILED, 'swap'],
    [TRACKING_EVENTS.PEG_SWAP_FAILED, 'swap'],
    [TRACKING_EVENTS.WRAP_FAILED, 'swap'],
    [TRACKING_EVENTS.BRIDGE_TO_MAINNET_ERROR, 'bridge'],
    [TRACKING_EVENTS.BUY_CRYPTO_ORDER_FAILED, 'buy_crypto'],
    [TRACKING_EVENTS.ORCHESTRA_ORDER_FAILED, 'buy_crypto'],
    [TRACKING_EVENTS.CASH_OUT_ORDER_FAILED, 'cash_out'],
    [TRACKING_EVENTS.SIGNUP_FAILED, 'signup'],
    [TRACKING_EVENTS.EMAIL_VERIFICATION_FAILED, 'signup'],
    [TRACKING_EVENTS.PASSKEY_CREATION_FAILED, 'signup'],
    [TRACKING_EVENTS.USERNAME_UNAVAILABLE, 'signup'],
    [TRACKING_EVENTS.LOGIN_FAILED, 'login'],
    [TRACKING_EVENTS.TIER_LOCK_FAILED, 'tier'],
    [TRACKING_EVENTS.QUEST_WALLET_UPDATE_FAILED, 'rewards'],
    [TRACKING_EVENTS.VIRTUAL_ACCOUNT_CREATION_FAILED, 'deposit'],
    [TRACKING_EVENTS.ERROR_BOUNDARY, 'app'],
    [TRACKING_EVENTS.QR_CODE_SCAN_FAILED, 'other'],
  ])('%s → %s', (name, flow) => {
    expect(inferErrorFlow(name)).toBe(flow);
  });
});

describe('toFlowErrorReport', () => {
  it('reads the reason, code, step and transaction from whichever keys the call site used', () => {
    expect(
      toFlowErrorReport(TRACKING_EVENTS.DEPOSIT_ERROR, 'Deposit Error', {
        error_message: 'Insufficient balance',
        error_code: 'INSUFFICIENT_BALANCE',
        failed_stage: 'permit',
        clientTxId: 'tx-1',
        amount: '10',
      }),
    ).toEqual({
      kind: 'flow',
      flow: 'deposit',
      amplitudeEvent: 'Deposit Error',
      message: 'Insufficient balance',
      code: 'INSUFFICIENT_BALANCE',
      step: 'permit',
      refs: { clientTxId: 'tx-1' },
      claimedUsername: undefined,
    });
  });

  it('prefers `error` over the other message keys and skips empty ones', () => {
    const report = toFlowErrorReport('swap_failed', 'Swap Failed', {
      error: '  ',
      error_message: 'Slippage too high',
      message: 'ignored',
    });
    expect(report.message).toBe('Slippage too high');
  });

  it('accepts Error objects and numeric codes', () => {
    const report = toFlowErrorReport('send_transaction_error', 'Send Transaction Error', {
      error: new Error('execution reverted'),
      code: 500,
    });
    expect(report.message).toBe('execution reverted');
    expect(report.code).toBe('500');
  });

  it('falls back to the event name when nothing says why', () => {
    expect(toFlowErrorReport('wrap_failed', 'Wrap Failed', {}).message).toBe('wrap_failed');
  });

  it('only keeps the typed username for login failures', () => {
    expect(
      toFlowErrorReport(TRACKING_EVENTS.LOGIN_FAILED, 'Login Failed', { username: 'alice' })
        .claimedUsername,
    ).toBe('alice');
    expect(
      toFlowErrorReport(TRACKING_EVENTS.SIGNUP_FAILED, 'Signup Failed', { username: 'alice' })
        .claimedUsername,
    ).toBeUndefined();
  });
});

describe('reportFlowError', () => {
  beforeEach(() => mockReportError.mockClear());

  it('reports a failed flow', () => {
    reportFlowError(TRACKING_EVENTS.CARD_DEPOSIT_FAILED, 'Card Deposit Failed', {
      error: 'boom',
    });
    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'flow', flow: 'card_deposit', message: 'boom' }),
    );
  });

  it('leaves error_boundary to the boundary, which reports the crash itself', () => {
    reportFlowError(TRACKING_EVENTS.ERROR_BOUNDARY, 'Error Boundary', { message: 'boom' });
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('never throws', () => {
    mockReportError.mockImplementationOnce(() => {
      throw new Error('broken');
    });
    expect(() => reportFlowError('swap_failed', 'Swap Failed', {})).not.toThrow();
  });
});
