import {
  extractUserFacingReason,
  getKYCButtonText,
  getKYCDescription,
  isRainKYCButtonDisabled,
} from '@/hooks/useCardSteps/kycDisplayHelpers';
import { KycWarning, RainApplicationStatus } from '@/lib/types';

// A representative Rain forward-failure message: a multi-clause JSON-schema
// validation string where the third clause is the informative one.
const RAIN_VALIDATION_MESSAGE =
  "body must have required property 'sumsubShareToken', " +
  "body must have required property 'personaShareToken', " +
  'body/address/line1 must NOT have more than 100 characters, ' +
  'body must match exactly one schema in oneOf, ' +
  "body must have required property 'key', " +
  'body must match exactly one schema in oneOf';

describe('extractUserFacingReason', () => {
  it('returns the third comma-separated clause for multi-clause Rain errors', () => {
    expect(extractUserFacingReason(RAIN_VALIDATION_MESSAGE)).toBe(
      'body/address/line1 must NOT have more than 100 characters',
    );
  });

  it('returns the whole message when there are no comma-separated clauses', () => {
    const msg = 'A valid 9-digit Social Security Number is required for US residents.';
    expect(extractUserFacingReason(msg)).toBe(msg);
  });

  it('returns the whole message when there are fewer than three clauses', () => {
    const msg = 'body/address/line1 too long, body must match exactly one schema in oneOf';
    expect(extractUserFacingReason(msg)).toBe(msg);
  });

  it('trims whitespace and handles empty / nullish input', () => {
    expect(extractUserFacingReason('   ')).toBe('');
    expect(extractUserFacingReason(undefined)).toBe('');
    expect(extractUserFacingReason(null)).toBe('');
  });
});

describe('Didit→Rain forward failure (DIDIT_FORWARD_FAILED)', () => {
  const warning: KycWarning = {
    risk: 'CARD_ACTIVATION_FAILED',
    short_description: RAIN_VALIDATION_MESSAGE,
  };

  it('shows "Contact support" as the button text', () => {
    expect(getKYCButtonText(RainApplicationStatus.DIDIT_FORWARD_FAILED)).toBe('Contact support');
  });

  it('keeps the support button enabled', () => {
    expect(isRainKYCButtonDisabled(RainApplicationStatus.DIDIT_FORWARD_FAILED)).toBe(false);
  });

  it('surfaces only the informative clause, never the whole raw message', () => {
    const description = getKYCDescription(RainApplicationStatus.DIDIT_FORWARD_FAILED, [warning]);

    expect(description).toContain('body/address/line1 must NOT have more than 100 characters');
    // The noisy required/oneOf clauses must never leak into the displayed copy.
    expect(description).not.toContain('sumsubShareToken');
    expect(description).not.toContain('personaShareToken');
    expect(description).toContain('contact support');
  });

  it('falls back to a generic support message when no reason was captured', () => {
    const description = getKYCDescription(RainApplicationStatus.DIDIT_FORWARD_FAILED, []);

    expect(description).toBe(
      "We couldn't complete your card application. Please contact support to continue.",
    );
  });
});
