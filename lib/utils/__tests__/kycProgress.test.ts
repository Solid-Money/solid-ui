/// <reference types="jest" />

import { CardStatusResponse, KycStatus, RainApplicationStatus } from '@/lib/types';
import { isKycAwaitingDecision, resolveKycProgress } from '@/lib/utils/kyc/verificationProgress';

const STARTED_AT = 1_700_000_000_000;

const cardStatus = (overrides: Partial<CardStatusResponse> = {}): CardStatusResponse => overrides;

describe('resolveKycProgress', () => {
  it('reports not-started when no provider has seen the user', () => {
    expect(resolveKycProgress(null, null)).toBe('not-started');
    expect(resolveKycProgress(undefined, undefined)).toBe('not-started');
    expect(resolveKycProgress(cardStatus({ kycStatus: KycStatus.NOT_STARTED }), null)).toBe(
      'not-started',
    );
    expect(
      resolveKycProgress(
        cardStatus({ rainApplicationStatus: RainApplicationStatus.NOT_STARTED }),
        null,
      ),
    ).toBe('not-started');
  });

  it('reports unfinished for a user who opened the SDK and walked away', () => {
    // `/cards/status` still reads not_started (or 404s into null) for a while;
    // the local marker is the only evidence they were ever in the flow.
    expect(resolveKycProgress(null, STARTED_AT)).toBe('unfinished');
    expect(resolveKycProgress(cardStatus({ kycStatus: KycStatus.NOT_STARTED }), STARTED_AT)).toBe(
      'unfinished',
    );
  });

  describe('the backend kycStatus ladder (Didit-only phase, and all of Wirex/Sumsub)', () => {
    it.each([KycStatus.INCOMPLETE, KycStatus.AWAITING_QUESTIONNAIRE, KycStatus.AWAITING_UBO])(
      'leaves %s with the user',
      status => {
        expect(resolveKycProgress(cardStatus({ kycStatus: status }), null)).toBe('unfinished');
      },
    );

    it.each([KycStatus.UNDER_REVIEW, KycStatus.PAUSED])(
      'treats %s as waiting on a decision',
      status => {
        expect(resolveKycProgress(cardStatus({ kycStatus: status }), STARTED_AT)).toBe('in-review');
      },
    );

    it.each([KycStatus.REJECTED, KycStatus.OFFBOARDED])('treats %s as closed', status => {
      expect(resolveKycProgress(cardStatus({ kycStatus: status }), STARTED_AT)).toBe('rejected');
    });

    it('reports approved', () => {
      expect(resolveKycProgress(cardStatus({ kycStatus: KycStatus.APPROVED }), null)).toBe(
        'approved',
      );
    });
  });

  describe("Rain's application status, the later stage of the same funnel", () => {
    it.each([RainApplicationStatus.NEEDS_VERIFICATION, RainApplicationStatus.NEEDS_INFORMATION])(
      'leaves %s with the user',
      status => {
        expect(resolveKycProgress(cardStatus({ rainApplicationStatus: status }), null)).toBe(
          'unfinished',
        );
      },
    );

    it.each([RainApplicationStatus.PENDING, RainApplicationStatus.MANUAL_REVIEW])(
      'treats %s as waiting on a decision',
      status => {
        expect(resolveKycProgress(cardStatus({ rainApplicationStatus: status }), null)).toBe(
          'in-review',
        );
      },
    );

    it.each([
      RainApplicationStatus.DENIED,
      RainApplicationStatus.LOCKED,
      RainApplicationStatus.CANCELED,
    ])('treats %s as closed', status => {
      expect(resolveKycProgress(cardStatus({ rainApplicationStatus: status }), null)).toBe(
        'rejected',
      );
    });

    it('reports approved', () => {
      expect(
        resolveKycProgress(
          cardStatus({ rainApplicationStatus: RainApplicationStatus.APPROVED }),
          null,
        ),
      ).toBe('approved');
    });

    it('wins over the backend kycStatus when both are present', () => {
      // Didit approving only forwards the applicant to Rain, which sets
      // kycStatus back to under_review; Rain's own verdict is the later word.
      expect(
        resolveKycProgress(
          cardStatus({
            kycStatus: KycStatus.UNDER_REVIEW,
            rainApplicationStatus: RainApplicationStatus.APPROVED,
          }),
          null,
        ),
      ).toBe('approved');
      expect(
        resolveKycProgress(
          cardStatus({
            kycStatus: KycStatus.APPROVED,
            rainApplicationStatus: RainApplicationStatus.DENIED,
          }),
          null,
        ),
      ).toBe('rejected');
    });

    it('falls through to kycStatus when Rain has not seen the applicant', () => {
      expect(
        resolveKycProgress(
          cardStatus({
            kycStatus: KycStatus.UNDER_REVIEW,
            rainApplicationStatus: RainApplicationStatus.NOT_STARTED,
          }),
          null,
        ),
      ).toBe('in-review');
    });

    it('ignores a status this build does not recognise', () => {
      // A backend that has moved ahead of the app: the unknown Rain value is not
      // evidence of anything, so kycStatus decides.
      expect(
        resolveKycProgress(
          cardStatus({
            kycStatus: KycStatus.APPROVED,
            rainApplicationStatus: 'somethingNew' as RainApplicationStatus,
          }),
          null,
        ),
      ).toBe('approved');
    });
  });
});

/**
 * The question every entry point into the card flow asks before offering to
 * start verification. Getting it wrong for one issuer is what showed a
 * Wirex/Sumsub applicant the "Verify now" prompt — and then country selection —
 * while their submitted verification was still being decided.
 */
describe('isKycAwaitingDecision', () => {
  it('is false before anyone has started', () => {
    expect(isKycAwaitingDecision(null)).toBe(false);
    expect(isKycAwaitingDecision(undefined)).toBe(false);
    expect(isKycAwaitingDecision(cardStatus({ kycStatus: KycStatus.NOT_STARTED }))).toBe(false);
  });

  it('is true for a Wirex/Sumsub applicant, which has no Rain application at all', () => {
    expect(isKycAwaitingDecision(cardStatus({ kycStatus: KycStatus.UNDER_REVIEW }))).toBe(true);
  });

  it.each([RainApplicationStatus.PENDING, RainApplicationStatus.MANUAL_REVIEW])(
    'is true for a Rain/Didit applicant at %s, even with Didit already approved',
    status => {
      expect(
        isKycAwaitingDecision(
          cardStatus({ kycStatus: KycStatus.APPROVED, rainApplicationStatus: status }),
        ),
      ).toBe(true);
    },
  );

  it('is true while Didit decides, before Rain has seen the applicant', () => {
    expect(
      isKycAwaitingDecision(
        cardStatus({
          kycStatus: KycStatus.UNDER_REVIEW,
          rainApplicationStatus: RainApplicationStatus.NOT_STARTED,
        }),
      ),
    ).toBe(true);
  });

  it.each([
    ['the user still has a step to take', { kycStatus: KycStatus.INCOMPLETE }],
    [
      'Rain wants an external verification step',
      { rainApplicationStatus: RainApplicationStatus.NEEDS_VERIFICATION },
    ],
    [
      'Rain wants more information',
      { rainApplicationStatus: RainApplicationStatus.NEEDS_INFORMATION },
    ],
    ['verification passed', { kycStatus: KycStatus.APPROVED }],
    ['verification was declined', { kycStatus: KycStatus.REJECTED }],
    ['Rain closed the application', { rainApplicationStatus: RainApplicationStatus.DENIED }],
  ])('is false when %s', (_case, overrides) => {
    expect(isKycAwaitingDecision(cardStatus(overrides))).toBe(false);
  });
});
