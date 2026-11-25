import { offerFirstYearFeeUsd } from '@/lib/tierUpgrade';
import { RewardsTier } from '@/lib/types';

import type { TierBenefits, TierOffer } from '@/lib/types';

export const BLACK_FRIDAY_PREVIEW_END = '2026-12-04T00:00:00Z';

const DESIGN_OFFERS = {
  [RewardsTier.PRIME]: {
    beforeUsd: 199,
    saleUsd: 139,
    beforeFuse: 70_000,
    saleFuse: 49_000,
    earnHoldUsd: 7_500,
  },
  [RewardsTier.ULTRA]: {
    beforeUsd: 999,
    saleUsd: 699,
    beforeFuse: 600_000,
    saleFuse: 420_000,
    earnHoldUsd: 35_000,
  },
};

export interface BlackFridayOffer {
  beforeUsd: number;
  saleUsd: number;
  beforeFuse?: number;
  lockFuse?: number;
  /** QA design value until the membership API quotes an Earn qualification. */
  earnHoldUsd?: number;
  /** When set, the tier benefits endpoint is quoting the promotional purchase rate. */
  cashback?: number;
  cashbackCap?: string;
  endsAt: string;
  preview: boolean;
}

export function blackFridayOffer(
  tier: RewardsTier,
  offer: TierOffer | undefined,
  benefits: TierBenefits | undefined,
  campaign: { enabled: boolean; preview: boolean },
  now = Date.now(),
): BlackFridayOffer | undefined {
  if (!campaign.enabled || tier === RewardsTier.CORE) return undefined;

  const design = DESIGN_OFFERS[tier];
  if (campaign.preview) {
    return {
      beforeUsd: design.beforeUsd,
      saleUsd: design.saleUsd,
      beforeFuse: design.beforeFuse,
      lockFuse: design.saleFuse,
      earnHoldUsd: design.earnHoldUsd,
      ...(tier === RewardsTier.ULTRA ? { cashback: 10, cashbackCap: '$200' } : {}),
      endsAt: BLACK_FRIDAY_PREVIEW_END,
      preview: true,
    };
  }

  const firstYear = offerFirstYearFeeUsd(offer);
  const annual = offer?.annualFeeUsd;
  const endsAt = offer?.saleEndsAt;
  if (
    !endsAt ||
    !(Date.parse(endsAt) > now) ||
    firstYear == null ||
    annual == null ||
    firstYear >= annual
  ) {
    return undefined;
  }

  const lockFuse = offer?.lockAvailable && offer.lockFuse > 0 ? offer.lockFuse : undefined;
  const cashbackTitle = benefits?.cardCashback.title;
  const rate = Number(cashbackTitle?.match(/^([0-9.]+)%$/)?.[1]);
  const cashbackCap = benefits?.cardCashbackCap.title.match(/\$[\d,.]+/)?.[0];

  return {
    beforeUsd: annual,
    saleUsd: firstYear,
    lockFuse,
    beforeFuse: lockFuse === design.saleFuse ? design.beforeFuse : undefined,
    ...(tier === RewardsTier.ULTRA && rate === 10 ? { cashback: rate, cashbackCap } : {}),
    endsAt,
    preview: false,
  };
}

export const formatBlackFridayFuse = (amount: number) =>
  `${(amount / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })}K`;
