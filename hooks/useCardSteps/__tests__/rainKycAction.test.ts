import { resolveRainKycAction } from '@/hooks/useCardSteps/rainKycAction';
import { RainApplicationStatus } from '@/lib/types';

const resolve = (input: Partial<Parameters<typeof resolveRainKycAction>[0]> = {}) =>
  resolveRainKycAction({ hasUsableLink: false, ...input });

describe('resolveRainKycAction', () => {
  it('sends a resubmission to the Rain verification link', () => {
    expect(
      resolve({
        rainApplicationStatus: RainApplicationStatus.NEEDS_INFORMATION,
        hasUsableLink: true,
      }),
    ).toEqual({ type: 'external-link' });

    expect(
      resolve({
        rainApplicationStatus: RainApplicationStatus.NEEDS_VERIFICATION,
        hasUsableLink: true,
      }),
    ).toEqual({ type: 'external-link' });
  });

  it('reports an unavailable link rather than silently doing nothing', () => {
    expect(
      resolve({
        rainApplicationStatus: RainApplicationStatus.NEEDS_INFORMATION,
        hasUsableLink: false,
      }),
    ).toEqual({ type: 'link-unavailable' });
  });

  it('offers support for locked and canceled applications', () => {
    expect(resolve({ rainApplicationStatus: RainApplicationStatus.LOCKED })).toEqual({
      type: 'support',
    });
    expect(resolve({ rainApplicationStatus: RainApplicationStatus.CANCELED })).toEqual({
      type: 'support',
    });
  });

  it.each([
    RainApplicationStatus.DENIED,
    RainApplicationStatus.APPROVED,
    RainApplicationStatus.PENDING,
    RainApplicationStatus.MANUAL_REVIEW,
  ])('offers no action for %s', status => {
    expect(resolve({ rainApplicationStatus: status })).toEqual({ type: 'none' });
  });

  describe('when no Rain status is known', () => {
    it('starts a fresh KYC only when no provider consumer exists', () => {
      expect(resolve({ kycApplicationEstablished: false })).toEqual({ type: 'start-kyc' });
      expect(
        resolve({
          rainApplicationStatus: RainApplicationStatus.NOT_STARTED,
          kycApplicationEstablished: false,
        }),
      ).toEqual({ type: 'start-kyc' });
    });

    /**
     * The field regression: an established Rain consumer means
     * createDiditSession answers 409 KYC_ALREADY_EXISTS, and the user ends up
     * stranded on the "Redirecting..." hand-off. Never restart KYC there.
     */
    it('never restarts KYC once a provider consumer exists', () => {
      expect(resolve({ kycApplicationEstablished: true, hasUsableLink: true })).toEqual({
        type: 'external-link',
      });
      expect(resolve({ kycApplicationEstablished: true, hasUsableLink: false })).toEqual({
        type: 'link-unavailable',
      });
      expect(
        resolve({
          rainApplicationStatus: RainApplicationStatus.NOT_STARTED,
          kycApplicationEstablished: true,
          hasUsableLink: true,
        }),
      ).toEqual({ type: 'external-link' });
    });
  });
});
