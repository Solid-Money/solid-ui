import { shouldRestartKycSession } from '@/components/kyc/useReinitOnRefocus';

/**
 * The KYC screens are tab routes that are frozen, not unmounted, when the user
 * leaves them — so the session state of a previous visit is still there when
 * they come back. These cases are that decision: is the phase we are holding
 * one that is finished with (restart it) or one still in flight (leave it be)?
 */
describe('shouldRestartKycSession', () => {
  describe('re-entering the screen', () => {
    it.each(['completed', 'error', 'unavailable'])('restarts a spent %s session', phase => {
      expect(shouldRestartKycSession(phase, true)).toBe(true);
    });

    /**
     * The bug this exists for: Sumsub RED + rejectType RETRY leaves the backend
     * on kycStatus 'incomplete', the activate screen offers "Continue
     * verification", and the user landed on the previous visit's "Verification
     * submitted" hand-off with the SDK never reopening.
     */
    it('restarts after a hand-off, so a re-upload request can be actioned', () => {
      expect(shouldRestartKycSession('completed', true)).toBe(true);
    });

    it.each(['loading', 'ready', 'started'])('leaves an in-flight %s session alone', phase => {
      expect(shouldRestartKycSession(phase, true)).toBe(false);
    });
  });

  describe('without having left the screen', () => {
    /**
     * Focus callbacks also re-run for reasons that are not a re-entry. Restarting
     * there would tear down the session the user is in the middle of — including
     * the hand-off interstitial on its way out.
     */
    it.each(['loading', 'ready', 'started', 'completed', 'error', 'unavailable'])(
      'never restarts a %s session',
      phase => {
        expect(shouldRestartKycSession(phase, false)).toBe(false);
      },
    );
  });
});
