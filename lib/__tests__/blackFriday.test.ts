import { blackFridayOffer } from '@/lib/blackFriday';
import { RewardsTier } from '@/lib/types';

import type { TierOffer } from '@/lib/types';

const endsAt = '2026-12-04T00:00:00Z';
const now = Date.parse('2026-11-28T00:00:00Z');
const prime: TierOffer = {
  tier: RewardsTier.PRIME,
  annualFeeUsd: 199,
  firstYearFeeUsd: 139,
  saleEndsAt: endsAt,
  cashAvailable: true,
  lockAvailable: true,
  lockFuse: 49_000,
  held: false,
};
const live = { enabled: true, preview: false };

describe('Black Friday tier presentation', () => {
  it('uses the quoted introductory price, renewal, lock and expiry', () => {
    expect(blackFridayOffer(RewardsTier.PRIME, prime, undefined, live, now)).toEqual({
      beforeUsd: 199,
      saleUsd: 139,
      beforeFuse: 70_000,
      lockFuse: 49_000,
      endsAt,
      preview: false,
    });
  });

  it('hides sale presentation when Promotions is switched off, even with a cached quote', () => {
    expect(
      blackFridayOffer(RewardsTier.PRIME, prime, undefined, { ...live, enabled: false }, now),
    ).toBeUndefined();
  });

  it('requires an active sale quote in release builds', () => {
    expect(blackFridayOffer(RewardsTier.PRIME, undefined, undefined, live, now)).toBeUndefined();
    expect(
      blackFridayOffer(RewardsTier.PRIME, prime, undefined, live, Date.parse(endsAt)),
    ).toBeUndefined();
    expect(
      blackFridayOffer(RewardsTier.PRIME, { ...prime, firstYearFeeUsd: 199 }, undefined, live, now),
    ).toBeUndefined();
  });

  it('lets development preview the design with no billable quote', () => {
    expect(
      blackFridayOffer(
        RewardsTier.ULTRA,
        undefined,
        undefined,
        { enabled: true, preview: true },
        now,
      ),
    ).toMatchObject({
      beforeUsd: 999,
      saleUsd: 699,
      lockFuse: 420_000,
      earnHoldUsd: 35_000,
      cashback: 10,
      preview: true,
    });
    expect(
      blackFridayOffer(
        RewardsTier.PRIME,
        undefined,
        undefined,
        { enabled: true, preview: true },
        now,
      ),
    ).toMatchObject({ earnHoldUsd: 7_500 });
  });
});
