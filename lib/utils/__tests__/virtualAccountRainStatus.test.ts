import { CardProvider, RainApplicationStatus } from '@/lib/types';
import {
  getVirtualAccountRainStatus,
  isVirtualAccountRainApproved,
} from '@/lib/utils/virtualAccountRainStatus';

describe('getVirtualAccountRainStatus', () => {
  it('reads the Rain row for a Wirex cardholder, whose flat field is empty', () => {
    // The field incident: the flat field came off the Wirex card row, so an
    // approved Rain application read as "not started" and the apply button
    // parked the user on the pending page forever.
    const cardStatus = {
      provider: CardProvider.WIREX,
      rainKycApplicationEstablished: true,
      rainApplication: { status: RainApplicationStatus.APPROVED },
    };

    expect(getVirtualAccountRainStatus(cardStatus)).toBe(RainApplicationStatus.APPROVED);
    expect(isVirtualAccountRainApproved(cardStatus)).toBe(true);
  });

  it('prefers the Rain row over the flat field when both are present', () => {
    expect(
      getVirtualAccountRainStatus({
        rainApplicationStatus: RainApplicationStatus.PENDING,
        rainApplication: { status: RainApplicationStatus.APPROVED },
      }),
    ).toBe(RainApplicationStatus.APPROVED);
  });

  it('falls back to the flat field when the server sends no Rain row block', () => {
    const cardStatus = { rainApplicationStatus: RainApplicationStatus.APPROVED };

    expect(getVirtualAccountRainStatus(cardStatus)).toBe(RainApplicationStatus.APPROVED);
    expect(isVirtualAccountRainApproved(cardStatus)).toBe(true);
  });

  it('is undefined, and not approved, when there is no Rain application at all', () => {
    expect(getVirtualAccountRainStatus(undefined)).toBeUndefined();
    expect(getVirtualAccountRainStatus(null)).toBeUndefined();
    expect(getVirtualAccountRainStatus({ provider: CardProvider.WIREX })).toBeUndefined();
    expect(isVirtualAccountRainApproved({ provider: CardProvider.WIREX })).toBe(false);
  });

  it('does not treat a denied or pending Rain row as approved', () => {
    expect(
      isVirtualAccountRainApproved({ rainApplication: { status: RainApplicationStatus.DENIED } }),
    ).toBe(false);
    expect(
      isVirtualAccountRainApproved({ rainApplication: { status: RainApplicationStatus.PENDING } }),
    ).toBe(false);
  });
});
