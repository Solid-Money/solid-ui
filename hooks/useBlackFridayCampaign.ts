import { useIsFocused } from '@react-navigation/native';

import { usePromotionsBanners } from '@/hooks/usePromotionsBanners';
import { useTierBenefits } from '@/hooks/useRewards';
import { useTierMembership } from '@/hooks/useTierMembership';
import { blackFridayOffer } from '@/lib/blackFriday';
import { findOffer } from '@/lib/tierUpgrade';
import { RewardsTier } from '@/lib/types';
import { useBlackFridayQaPreviewStore } from '@/store/useBlackFridayQaPreviewStore';

import type { BlackFridayOffer } from '@/lib/blackFriday';
import type { PromotionsBannerItem } from '@/lib/types';

export const BLACK_FRIDAY_SLUG = 'black-friday';

/** The Wallet campaign governs the promotion across Wallet and Rewards. */
export function useBlackFridayCampaign() {
  const focused = useIsFocused();
  const qaPreview = useBlackFridayQaPreviewStore(state => state.enabled);
  const { banners, isError } = usePromotionsBanners({
    page: '/',
    refreshInterval: focused ? 15_000 : undefined,
  });
  const banner =
    qaPreview || isError ? undefined : banners.find(item => item.slug === BLACK_FRIDAY_SLUG);
  const preview =
    qaPreview || (__DEV__ && process.env.EXPO_PUBLIC_BLACK_FRIDAY_PREVIEW !== 'false' && !banner);

  return { banners, banner, focused, preview, qaPreview, enabled: !!banner || preview };
}

export interface BlackFridayPromotionData {
  banner?: PromotionsBannerItem;
  prime: BlackFridayOffer;
  ultra: BlackFridayOffer;
}

export function useBlackFridayPromotion() {
  const campaign = useBlackFridayCampaign();
  const { banners, banner, focused } = campaign;
  const { data: membership, isError: membershipError } = useTierMembership({
    enabled: !!banner,
    refreshInterval: banner && focused ? 15_000 : undefined,
  });
  const { data: benefits, isError: benefitsError } = useTierBenefits({ enabled: !!banner });
  const campaignOffer = (tier: RewardsTier) =>
    blackFridayOffer(
      tier,
      !membershipError && membership?.enabled ? findOffer(membership, tier) : undefined,
      benefitsError ? undefined : benefits?.find(benefit => benefit.tier === tier),
      campaign,
    );
  const prime = campaignOffer(RewardsTier.PRIME);
  const ultra = campaignOffer(RewardsTier.ULTRA);
  const matchesAdvertisedDiscount = (offer: BlackFridayOffer) =>
    Math.round((1 - offer.saleUsd / offer.beforeUsd) * 100) === 30;
  const promotion =
    prime && ultra && matchesAdvertisedDiscount(prime) && matchesAdvertisedDiscount(ultra)
      ? { banner, prime, ultra }
      : undefined;

  return { banners, promotion, qaPreview: campaign.qaPreview };
}
