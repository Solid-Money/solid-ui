/// <reference types="jest" />

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { isErrorEvent } from '@/lib/telemetry/errorEvents';

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
