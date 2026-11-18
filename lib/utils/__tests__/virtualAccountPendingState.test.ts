import { CardProvider, KycStatus, RainApplicationStatus } from '@/lib/types';
import { resolveVirtualAccountPendingState } from '@/lib/utils/virtualAccountPendingState';

/**
 * Every one of these used to render the same "you will be notified by mail"
 * screen, and none of them would ever have changed on its own.
 */
describe('resolveVirtualAccountPendingState', () => {
  // A Wirex cardholder: the flat fields describe their Wirex card.
  const wirexCardholder = {
    provider: CardProvider.WIREX,
    kycStatus: KycStatus.APPROVED,
  };

  it('waits while there is nothing to go on', () => {
    expect(resolveVirtualAccountPendingState(undefined)).toBe('waiting');
    expect(resolveVirtualAccountPendingState(null)).toBe('waiting');
    expect(resolveVirtualAccountPendingState(wirexCardholder)).toBe('waiting');
  });

  it('sends an approved Wirex cardholder on to open the account', () => {
    // The field incident: Rain had approved them, the flat field (Wirex row)
    // said nothing, and they sat on the pending page indefinitely.
    expect(
      resolveVirtualAccountPendingState({
        ...wirexCardholder,
        rainKycApplicationEstablished: true,
        rainApplication: {
          status: RainApplicationStatus.APPROVED,
          kycStatus: KycStatus.APPROVED,
        },
      }),
    ).toBe('approved');
  });

  it('sends an approved Rain cardholder on as well', () => {
    expect(
      resolveVirtualAccountPendingState({
        rainApplicationStatus: RainApplicationStatus.APPROVED,
        rainApplication: { status: RainApplicationStatus.APPROVED },
      }),
    ).toBe('approved');
  });

  it('reports a Rain denial, lock or cancellation as denied', () => {
    for (const status of [
      RainApplicationStatus.DENIED,
      RainApplicationStatus.LOCKED,
      RainApplicationStatus.CANCELED,
    ]) {
      expect(
        resolveVirtualAccountPendingState({
          ...wirexCardholder,
          rainKycApplicationEstablished: true,
          rainApplication: { status, kycStatus: KycStatus.REJECTED },
        }),
      ).toBe('denied');
    }
  });

  it('offers a fresh check after a Didit decline that never reached Rain', () => {
    expect(
      resolveVirtualAccountPendingState({
        ...wirexCardholder,
        rainKycApplicationEstablished: false,
        rainApplication: { kycStatus: KycStatus.REJECTED },
      }),
    ).toBe('verification-declined');
  });

  it('does not offer a fresh check when a Rain consumer already exists', () => {
    // The server would refuse a new session (409 KYC_ALREADY_EXISTS).
    expect(
      resolveVirtualAccountPendingState({
        ...wirexCardholder,
        rainKycApplicationEstablished: true,
        rainApplication: { kycStatus: KycStatus.REJECTED },
      }),
    ).toBe('waiting');
  });

  it('ignores a rejected flat kycStatus, which is the Wirex card, not the Rain row', () => {
    expect(
      resolveVirtualAccountPendingState({
        provider: CardProvider.WIREX,
        kycStatus: KycStatus.REJECTED,
      }),
    ).toBe('waiting');
  });

  it('reports a hand-off held on the savings deposit', () => {
    expect(
      resolveVirtualAccountPendingState({
        ...wirexCardholder,
        rainApplication: { kycStatus: KycStatus.INCOMPLETE, forwardPendingDeposit: true },
      }),
    ).toBe('deposit-required');
  });

  it('asks to verify again when Rain can never accept the SSN', () => {
    // Didit approved, the SSN answer was not 9 digits, and the hand-off failed
    // before Rain saw anything. This read as "waiting" for a decision that
    // would never come.
    expect(
      resolveVirtualAccountPendingState({
        ...wirexCardholder,
        rainApplication: {
          status: 'didit_forward_failed',
          kycStatus: KycStatus.INCOMPLETE,
          resubmitVerification: true,
        },
      }),
    ).toBe('verification-resubmit');
  });

  it('prefers verifying again over a deposit hold the forward already got past', () => {
    expect(
      resolveVirtualAccountPendingState({
        ...wirexCardholder,
        rainApplication: {
          kycStatus: KycStatus.INCOMPLETE,
          forwardPendingDeposit: true,
          resubmitVerification: true,
        },
      }),
    ).toBe('verification-resubmit');
  });

  it('keeps waiting through Rain review', () => {
    for (const status of [RainApplicationStatus.PENDING, RainApplicationStatus.MANUAL_REVIEW]) {
      expect(
        resolveVirtualAccountPendingState({
          ...wirexCardholder,
          rainKycApplicationEstablished: true,
          rainApplication: { status, kycStatus: KycStatus.UNDER_REVIEW },
        }),
      ).toBe('waiting');
    }
  });
});
