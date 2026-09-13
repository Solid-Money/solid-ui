/// <reference types="jest" />

import { EndorsementStatus } from '@/components/BankTransfer/enums';
import {
  BridgeCustomerEndorsement,
  CardProvider,
  CardStatusResponse,
  KycStatus,
  RainApplicationStatus,
} from '@/lib/types';
import { isCardIssuanceUnderReview } from '@/lib/utils/cardReviewState';

const endorsement = (overrides: {
  status: EndorsementStatus;
  requirements?: { pending?: string[] };
}): BridgeCustomerEndorsement => ({ name: 'cards', ...overrides }) as BridgeCustomerEndorsement;

const isUnderReview = (
  cardStatus: CardStatusResponse | null | undefined,
  cardsEndorsement?: BridgeCustomerEndorsement,
) => isCardIssuanceUnderReview({ cardStatus, cardsEndorsement });

/**
 * `/card/activate` used to read this from the bridge.xyz endorsement alone —
 * something neither live issuer has. A Wirex applicant whose Sumsub check was
 * still being decided therefore fell through to the steps list, which opens on
 * "Complete KYC": the "we just show the verify page again" report.
 */
describe('isCardIssuanceUnderReview', () => {
  describe('the two live issuers', () => {
    it('holds a Wirex/Sumsub applicant whose decision is still out', () => {
      expect(
        isUnderReview({ kycStatus: KycStatus.UNDER_REVIEW, provider: CardProvider.WIREX }),
      ).toBe(true);
    });

    it.each([RainApplicationStatus.PENDING, RainApplicationStatus.MANUAL_REVIEW])(
      'holds a Rain/Didit applicant at %s',
      rainApplicationStatus => {
        // Didit has approved by this point, which is why keying off kycStatus
        // alone would have shown this user the steps list.
        expect(isUnderReview({ kycStatus: KycStatus.APPROVED, rainApplicationStatus })).toBe(true);
      },
    );

    it('holds a Rain/Didit applicant while Didit itself is still deciding', () => {
      expect(
        isUnderReview({
          kycStatus: KycStatus.UNDER_REVIEW,
          rainApplicationStatus: RainApplicationStatus.NOT_STARTED,
        }),
      ).toBe(true);
    });
  });

  describe('states that still belong to the user', () => {
    it('does not hold someone who has never started', () => {
      expect(isUnderReview(undefined)).toBe(false);
      expect(isUnderReview(null)).toBe(false);
      expect(isUnderReview({ kycStatus: KycStatus.NOT_STARTED })).toBe(false);
    });

    it.each([KycStatus.INCOMPLETE, KycStatus.APPROVED, KycStatus.REJECTED])(
      'does not hold %s',
      kycStatus => {
        expect(isUnderReview({ kycStatus })).toBe(false);
      },
    );

    it.each([RainApplicationStatus.NEEDS_VERIFICATION, RainApplicationStatus.NEEDS_INFORMATION])(
      'does not hold %s — Rain is waiting on the user, and the step opens the link',
      rainApplicationStatus => {
        expect(isUnderReview({ kycStatus: KycStatus.APPROVED, rainApplicationStatus })).toBe(false);
      },
    );

    it('yields to a blocked activation, whose reason only the steps list renders', () => {
      expect(
        isUnderReview({
          kycStatus: KycStatus.UNDER_REVIEW,
          activationBlocked: true,
          activationBlockedReason: 'Missing SSN',
        }),
      ).toBe(false);
    });

    it('yields to an application parked on its deposit', () => {
      // "Top up and hold your $X" is the user's move; it lives on the steps list.
      expect(
        isUnderReview({
          kycStatus: KycStatus.UNDER_REVIEW,
          rainForwardPendingDeposit: true,
        }),
      ).toBe(false);
    });
  });

  describe('the deprecated bridge.xyz/Persona path, unchanged', () => {
    it('holds an endorsement with pending requirements', () => {
      expect(
        isUnderReview(
          {},
          endorsement({
            status: EndorsementStatus.INCOMPLETE,
            requirements: { pending: ['kyc_with_proof_of_address'] },
          }),
        ),
      ).toBe(true);
    });

    it('does not hold an incomplete endorsement with nothing pending', () => {
      expect(
        isUnderReview(
          {},
          endorsement({ status: EndorsementStatus.INCOMPLETE, requirements: { pending: [] } }),
        ),
      ).toBe(false);
    });

    it('does not hold an approved endorsement', () => {
      expect(isUnderReview({}, endorsement({ status: EndorsementStatus.APPROVED }))).toBe(false);
    });
  });
});
