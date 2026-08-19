import { path } from '@/constants/path';
import {
  CardProvider,
  CardStatus,
  CardStatusResponse,
  KycStatus,
  RainApplicationStatus,
} from '@/lib/types';
import { resolveCardPendingDestination } from '@/lib/utils/cardPendingRouting';

/**
 * `/card/pending` polls `/cards/status`, and this function is what makes that
 * wait self-terminating. Before it, a user whose decision had landed sat on
 * "your identity is being verified" until they thought to press back.
 */
describe('resolveCardPendingDestination', () => {
  const resolve = (
    cardStatus: CardStatusResponse | null | undefined,
    overrides: {
      kycFlow?: 'card' | 'va' | 'transfi' | null;
      hasRainVerificationCta?: boolean;
    } = {},
  ) =>
    resolveCardPendingDestination({
      cardStatus,
      kycFlow: overrides.kycFlow ?? 'card',
      hasRainVerificationCta: overrides.hasRainVerificationCta ?? false,
    });

  describe('waits while the decision is genuinely pending', () => {
    it('waits before any status has loaded', () => {
      expect(resolve(undefined)).toBeNull();
      expect(resolve(null)).toBeNull();
    });

    it('waits at under_review', () => {
      expect(resolve({ kycStatus: KycStatus.UNDER_REVIEW })).toBeNull();
    });

    it('waits at not_started', () => {
      // The user lands here the instant the KYC widget closes; the webhook that
      // moves them to under_review can be seconds behind. Treating that gap as
      // "nothing to wait for" would bounce them straight back out.
      expect(resolve({ kycStatus: KycStatus.NOT_STARTED })).toBeNull();
    });

    it('waits when the response carries no kycStatus at all', () => {
      expect(resolve({})).toBeNull();
    });

    it('waits on the intermediate awaiting_* statuses', () => {
      expect(resolve({ kycStatus: KycStatus.AWAITING_QUESTIONNAIRE })).toBeNull();
      expect(resolve({ kycStatus: KycStatus.AWAITING_UBO })).toBeNull();
    });
  });

  describe('moves the user on once it is not', () => {
    it('sends an approved Wirex user to activate, where step two opens itself', () => {
      // Wirex has no second adjudication, so there is no rainApplicationStatus.
      expect(resolve({ kycStatus: KycStatus.APPROVED, provider: CardProvider.WIREX })).toBe(
        path.CARD_ACTIVATE,
      );
    });

    it('sends an approved Rain user to ready only once Rain approved too', () => {
      expect(
        resolve({
          kycStatus: KycStatus.APPROVED,
          rainApplicationStatus: RainApplicationStatus.APPROVED,
        }),
      ).toBe(path.CARD_READY);
    });

    it('sends an approved Rain user still awaiting Rain to activate', () => {
      expect(
        resolve({
          kycStatus: KycStatus.APPROVED,
          rainApplicationStatus: RainApplicationStatus.PENDING,
        }),
      ).toBe(path.CARD_ACTIVATE);
    });

    it('carries a rejection to activate with the status, so step one explains it', () => {
      expect(resolve({ kycStatus: KycStatus.REJECTED })).toBe(
        `${String(path.CARD_ACTIVATE)}?kycStatus=${KycStatus.REJECTED}`,
      );
    });

    it('carries a resubmission request the same way', () => {
      expect(resolve({ kycStatus: KycStatus.INCOMPLETE })).toBe(
        `${String(path.CARD_ACTIVATE)}?kycStatus=${KycStatus.INCOMPLETE}`,
      );
    });

    it.each([KycStatus.PAUSED, KycStatus.OFFBOARDED])('carries %s too', status => {
      expect(resolve({ kycStatus: status })).toBe(
        `${String(path.CARD_ACTIVATE)}?kycStatus=${status}`,
      );
    });

    it('sends a blocked activation to activate even with no kycStatus', () => {
      // A blocked response can omit kycStatus entirely, and the activate page is
      // the only screen that renders the reason — without this the user waits on a
      // decision that has already been made.
      expect(resolve({ activationBlocked: true, activationBlockedReason: 'Missing SSN' })).toBe(
        path.CARD_ACTIVATE,
      );
    });

    it('sends a user whose card already opened to the card itself', () => {
      expect(
        resolve({
          status: CardStatus.ACTIVE,
          provider: CardProvider.WIREX,
          kycStatus: KycStatus.APPROVED,
        }),
      ).toBe(path.CARD_INFO);
    });

    it('does not treat a still-pending card as opened', () => {
      expect(
        resolve({
          status: CardStatus.PENDING,
          provider: CardProvider.WIREX,
          kycStatus: KycStatus.UNDER_REVIEW,
        }),
      ).toBeNull();
    });
  });

  describe('respects the flows that own their own resume path', () => {
    it('never navigates a virtual-account user away — they resume via Deposit', () => {
      for (const kycStatus of [
        KycStatus.APPROVED,
        KycStatus.REJECTED,
        KycStatus.INCOMPLETE,
        KycStatus.UNDER_REVIEW,
      ]) {
        expect(resolve({ kycStatus }, { kycFlow: 'va' })).toBeNull();
      }
    });

    it('stays put while the Rain external-verification CTA is on screen', () => {
      // That step is the user's to complete right now; navigating away takes the
      // only button that can finish it with them.
      expect(
        resolve(
          {
            kycStatus: KycStatus.INCOMPLETE,
            rainApplicationStatus: RainApplicationStatus.NEEDS_INFORMATION,
          },
          { hasRainVerificationCta: true },
        ),
      ).toBeNull();
    });
  });
});
