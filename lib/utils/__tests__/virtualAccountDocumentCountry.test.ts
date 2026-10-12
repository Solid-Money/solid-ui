import { CardProvider, KycStatus, RainApplicationStatus } from '@/lib/types';
import { needsDocumentCountryCheck } from '@/lib/utils/virtualAccountDocumentCountry';

describe('needsDocumentCountryCheck', () => {
  it('asks a first-time applicant', () => {
    expect(needsDocumentCountryCheck(undefined)).toBe(true);
    expect(needsDocumentCountryCheck({})).toBe(true);
    // A Wirex cardholder: their Sumsub-verified card says nothing about the
    // document Rain will be shown.
    expect(
      needsDocumentCountryCheck({ provider: CardProvider.WIREX, kycStatus: KycStatus.APPROVED }),
    ).toBe(true);
  });

  it('asks again after a Didit decline or an unstarted verification', () => {
    expect(needsDocumentCountryCheck({ rainApplication: { kycStatus: KycStatus.REJECTED } })).toBe(
      true,
    );
    expect(
      needsDocumentCountryCheck({ rainApplication: { kycStatus: KycStatus.NOT_STARTED } }),
    ).toBe(true);
  });

  it('skips once a Rain consumer or Rain status exists', () => {
    expect(needsDocumentCountryCheck({ rainKycApplicationEstablished: true })).toBe(false);
    expect(
      needsDocumentCountryCheck({ rainApplication: { status: RainApplicationStatus.APPROVED } }),
    ).toBe(false);
    expect(
      needsDocumentCountryCheck({ rainApplicationStatus: RainApplicationStatus.PENDING }),
    ).toBe(false);
  });

  it('skips when Didit already passed the document', () => {
    for (const kycStatus of [KycStatus.UNDER_REVIEW, KycStatus.INCOMPLETE, KycStatus.APPROVED]) {
      expect(needsDocumentCountryCheck({ rainApplication: { kycStatus } })).toBe(false);
    }
  });
});
