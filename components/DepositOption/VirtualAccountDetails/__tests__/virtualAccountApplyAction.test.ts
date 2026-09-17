import { resolveVirtualAccountApplyAction } from '@/components/DepositOption/VirtualAccountDetails/virtualAccountApplyAction';
import { RainApplicationStatus } from '@/lib/types';

describe('resolveVirtualAccountApplyAction', () => {
  /**
   * The failure this exists for. A Wirex user's account is issued by Wirex, so
   * `rainApplicationStatus` is absent and always will be — every branch below
   * "Rain approved" therefore sent them to /kyc, where the backend refused a
   * new session (409 KYC_ALREADY_EXISTS) because their verification was already
   * on file, and the app dropped them onto a card page. From the outside,
   * "Verify now" spun and returned without ever opening a verification.
   */
  describe('a Wirex user', () => {
    it('goes to their own bank screen, never into the Rain KYC flow', () => {
      expect(
        resolveVirtualAccountApplyAction({
          provider: 'wirex',
          rainApplicationStatus: undefined,
          kycApplicationEstablished: true,
        }),
      ).toEqual({ type: 'wirex-details' });
    });

    // Wirex users carry the wallet address in providerCustomerId, so the
    // established-KYC flag is set for them too — the provider has to be read
    // first or they fall into the Rain branches regardless.
    it('is routed on the provider before anything Rain says', () => {
      expect(
        resolveVirtualAccountApplyAction({
          provider: 'wirex',
          rainApplicationStatus: RainApplicationStatus.APPROVED,
          kycApplicationEstablished: false,
        }),
      ).toEqual({ type: 'wirex-details' });
    });
  });

  describe('a Rain user', () => {
    it('goes straight to the terms step once Rain has approved them', () => {
      expect(
        resolveVirtualAccountApplyAction({
          provider: 'rain',
          rainApplicationStatus: RainApplicationStatus.APPROVED,
          kycApplicationEstablished: true,
        }),
      ).toEqual({ type: 'rain-tos' });
    });

    it('starts verification only when no application exists', () => {
      expect(
        resolveVirtualAccountApplyAction({
          provider: 'rain',
          rainApplicationStatus: undefined,
          kycApplicationEstablished: false,
        }),
      ).toEqual({ type: 'start-kyc' });
    });

    // A missing status is not evidence that nothing exists. Reading it as
    // "never applied" is what produced the guaranteed 409.
    it('shows the application instead of restarting KYC when a consumer exists', () => {
      expect(
        resolveVirtualAccountApplyAction({
          provider: 'rain',
          rainApplicationStatus: undefined,
          kycApplicationEstablished: true,
        }),
      ).toEqual({ type: 'rain-application' });
    });

    it('shows the application while Rain is waiting on the applicant', () => {
      for (const status of [
        RainApplicationStatus.NEEDS_VERIFICATION,
        RainApplicationStatus.NEEDS_INFORMATION,
      ]) {
        expect(
          resolveVirtualAccountApplyAction({
            provider: 'rain',
            rainApplicationStatus: status,
            kycApplicationEstablished: true,
          }),
        ).toEqual({ type: 'rain-application' });
      }
    });
  });

  // The provider lookup is in flight. Treating that as Rain is what showed
  // Wirex users a pitch for a product they cannot have, so the CTA waits — but
  // if it is ever asked, it must not claim a fresh check can be started for
  // someone who already has one.
  it('does not start a new check while the provider is still resolving', () => {
    expect(
      resolveVirtualAccountApplyAction({
        provider: 'loading',
        rainApplicationStatus: undefined,
        kycApplicationEstablished: true,
      }),
    ).toEqual({ type: 'rain-application' });
  });
});
