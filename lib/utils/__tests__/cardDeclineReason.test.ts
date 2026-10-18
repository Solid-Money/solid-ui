import { cardDeclineReason, isInsufficientDecline } from '@/lib/utils/cardDeclineReason';

/**
 * The decline row on a card transaction.
 *
 * The property under test throughout is that the row never gets *less* useful than
 * the issuer's own reason: our code wins only where it says more, and every other
 * case falls back rather than emptying the row. A cardholder reading "insufficient
 * funds" beside a balance that covers the charge is the ticket this exists to stop.
 */
describe('cardDeclineReason', () => {
  it('prefers our code over the issuer reason it collapses', () => {
    expect(
      cardDeclineReason({
        declined_reason: 'insufficient funds',
        spend_details: { decline_reason: 'EXCEEDS_PER_TX_LIMIT' },
      }),
    ).toBe('Over per-payment limit');
  });

  it('names an unsettled-payments decline instead of blaming the balance', () => {
    expect(
      cardDeclineReason({
        declined_reason: 'insufficient funds',
        spend_details: { decline_reason: 'EXPOSURE_CAP' },
      }),
    ).toBe('Payments still settling');
  });

  it('still says the balance is short when that is genuinely why', () => {
    expect(
      cardDeclineReason({
        declined_reason: 'insufficient funds',
        spend_details: { decline_reason: 'INSUFFICIENT_FUNDS' },
      }),
    ).toBe('Insufficient balance');
  });

  /**
   * A paused module or an RPC timeout is ours, not the cardholder's. There is
   * nothing for them to act on, so the issuer's reason is left in place rather than
   * replaced with the name of one of our internals.
   */
  it('falls back to the issuer reason for an internal code', () => {
    expect(
      cardDeclineReason({
        declined_reason: 'general error',
        spend_details: { decline_reason: 'CHAIN_READ_FAILED' },
      }),
    ).toBe('General error');
  });

  it('falls back for a code this build has no wording for', () => {
    expect(
      cardDeclineReason({
        declined_reason: 'insufficient funds',
        spend_details: { decline_reason: 'SOME_FUTURE_CODE' },
      }),
    ).toBe('Insufficient funds');
  });

  /**
   * A decline the issuer made on its own side — a blocked card, an unsupported
   * merchant — never reached our authorization endpoint, so there is no ledger row
   * and no code to read.
   */
  it('uses the issuer reason when we have no spend record at all', () => {
    expect(cardDeclineReason({ declined_reason: 'card blocked' })).toBe('Card blocked');
  });

  it('returns nothing when neither side gave a reason', () => {
    expect(cardDeclineReason({})).toBeUndefined();
    expect(cardDeclineReason({ declined_reason: '   ' })).toBeUndefined();
    expect(cardDeclineReason({ spend_details: { decline_reason: '' } })).toBeUndefined();
  });

  it('matches a code whatever case or padding it arrives in', () => {
    expect(
      cardDeclineReason({
        declined_reason: 'insufficient funds',
        spend_details: { decline_reason: '  safe_paused  ' },
      }),
    ).toBe('Card spending paused');
  });
});

/** Whether the declined receipt offers "Not enough to pay" at all. */
describe('isInsufficientDecline', () => {
  it('trusts our code when the ledger answered', () => {
    expect(isInsufficientDecline({ spend_details: { decline_reason: 'INSUFFICIENT_FUNDS' } })).toBe(
      true,
    );
    // Wirex calls a limit decline "insufficient funds" too; our code knows better.
    expect(
      isInsufficientDecline({
        declined_reason: 'Insufficient funds',
        spend_details: { decline_reason: 'VELOCITY_LIMIT' },
      }),
    ).toBe(false);
  });

  it("falls back to the issuer's reason without one", () => {
    expect(isInsufficientDecline({ declined_reason: 'Insufficient funds' })).toBe(true);
    expect(isInsufficientDecline({ declined_reason: 'Declined external authorization' })).toBe(
      false,
    );
    expect(isInsufficientDecline({})).toBe(false);
  });
});
