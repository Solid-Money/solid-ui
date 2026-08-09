/// <reference types="jest" />

import { CardStatusResponse, KycStatus, RainApplicationStatus } from '@/lib/types';
import { shouldPromptToFinishKyc } from '@/lib/utils/kyc/verificationProgress';

const STARTED_AT = 1_700_000_000_000;

const cardStatus = (overrides: Partial<CardStatusResponse> = {}): CardStatusResponse => overrides;

describe('shouldPromptToFinishKyc', () => {
  it('stays hidden for a user who never started verification', () => {
    expect(shouldPromptToFinishKyc(null, null)).toBe(false);
    expect(shouldPromptToFinishKyc(cardStatus({ kycStatus: KycStatus.NOT_STARTED }), null)).toBe(
      false,
    );
    expect(
      shouldPromptToFinishKyc(
        cardStatus({ rainApplicationStatus: RainApplicationStatus.NOT_STARTED }),
        null,
      ),
    ).toBe(false);
  });

  it('shows for a user who opened the Didit SDK and walked away', () => {
    // The backend has nothing to show yet — the local marker is the only signal.
    expect(shouldPromptToFinishKyc(null, STARTED_AT)).toBe(true);
    expect(
      shouldPromptToFinishKyc(cardStatus({ kycStatus: KycStatus.NOT_STARTED }), STARTED_AT),
    ).toBe(true);
  });

  it('shows while the user still has a step left, marker or not', () => {
    expect(shouldPromptToFinishKyc(cardStatus({ kycStatus: KycStatus.INCOMPLETE }), null)).toBe(
      true,
    );
    expect(
      shouldPromptToFinishKyc(
        cardStatus({ kycStatus: KycStatus.AWAITING_QUESTIONNAIRE }),
        STARTED_AT,
      ),
    ).toBe(true);
    expect(
      shouldPromptToFinishKyc(
        cardStatus({ rainApplicationStatus: RainApplicationStatus.NEEDS_VERIFICATION }),
        null,
      ),
    ).toBe(true);
    expect(
      shouldPromptToFinishKyc(
        cardStatus({ rainApplicationStatus: RainApplicationStatus.NEEDS_INFORMATION }),
        null,
      ),
    ).toBe(true);
  });

  it('stays hidden once verification is finished', () => {
    expect(shouldPromptToFinishKyc(cardStatus({ kycStatus: KycStatus.APPROVED }), STARTED_AT)).toBe(
      false,
    );
    expect(
      shouldPromptToFinishKyc(
        cardStatus({
          kycStatus: KycStatus.APPROVED,
          rainApplicationStatus: RainApplicationStatus.APPROVED,
        }),
        STARTED_AT,
      ),
    ).toBe(false);
  });

  it('stays hidden while a decision is pending — there is nothing to finish', () => {
    expect(
      shouldPromptToFinishKyc(cardStatus({ kycStatus: KycStatus.UNDER_REVIEW }), STARTED_AT),
    ).toBe(false);
    expect(
      shouldPromptToFinishKyc(
        cardStatus({ rainApplicationStatus: RainApplicationStatus.PENDING }),
        STARTED_AT,
      ),
    ).toBe(false);
    expect(
      shouldPromptToFinishKyc(
        cardStatus({ rainApplicationStatus: RainApplicationStatus.MANUAL_REVIEW }),
        STARTED_AT,
      ),
    ).toBe(false);
  });

  it('stays hidden on a final rejection — the CTA would be a dead end', () => {
    expect(shouldPromptToFinishKyc(cardStatus({ kycStatus: KycStatus.REJECTED }), STARTED_AT)).toBe(
      false,
    );
    expect(
      shouldPromptToFinishKyc(cardStatus({ kycStatus: KycStatus.OFFBOARDED }), STARTED_AT),
    ).toBe(false);
    expect(
      shouldPromptToFinishKyc(
        cardStatus({ rainApplicationStatus: RainApplicationStatus.DENIED }),
        STARTED_AT,
      ),
    ).toBe(false);
  });

  it('lets the Rain application status override an earlier Didit status', () => {
    // Rain is the later stage of the same funnel: it needing the user beats a
    // stale `under_review` from the Didit phase, and vice versa.
    expect(
      shouldPromptToFinishKyc(
        cardStatus({
          kycStatus: KycStatus.UNDER_REVIEW,
          rainApplicationStatus: RainApplicationStatus.NEEDS_VERIFICATION,
        }),
        STARTED_AT,
      ),
    ).toBe(true);
    expect(
      shouldPromptToFinishKyc(
        cardStatus({
          kycStatus: KycStatus.INCOMPLETE,
          rainApplicationStatus: RainApplicationStatus.MANUAL_REVIEW,
        }),
        STARTED_AT,
      ),
    ).toBe(false);
  });
});
