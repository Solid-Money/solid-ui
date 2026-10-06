import {
  categoryCashbackPresentation,
  formatCashbackRate,
} from '@/components/Rewards/NewRewards/categoryCashback';
import { subscriptionCategoryLabel } from '@/components/Rewards/NewRewards/subscriptionBrands';
import {
  TIER_LABELS,
  tierPresentationContent,
} from '@/components/Rewards/NewRewards/tierBenefitsPresentation';
import { IS_TIER_CASHBACK_HARDCODED } from '@/lib/config';
import {
  resolveTierCashbackRate,
  resolveUserCashbackRate,
  TIER_CASHBACK_RATES,
} from '@/lib/tierCashback';
import {
  type Cashback,
  type CashbackInfo,
  RewardsTier,
  type RewardsUserData,
  type TierBenefits,
} from '@/lib/types';
import { getCashbackUsdValue } from '@/lib/utils/spendingInsights';

const DAY_MS = 86_400_000;

/** The tier a purchase is compared against in the upsell line. */
const NEXT_TIER: Record<RewardsTier, RewardsTier | null> = {
  [RewardsTier.CORE]: RewardsTier.PRIME,
  [RewardsTier.PRIME]: RewardsTier.ULTRA,
  [RewardsTier.ULTRA]: null,
};

export type CashbackTiming =
  /** Landed. `paidAt` is the date the escrow matured. */
  | { kind: 'paid'; paidAt: string }
  /** Still held. `holdDays` is the escrow length, when the row's dates give it. */
  | { kind: 'releasing'; payoutAt: string; holdDays?: number };

/** One run of footer copy; `highlight` draws it in brand green. */
export interface CashbackFooterSegment {
  text: string;
  highlight?: boolean;
}

export interface CashbackFooter {
  /**
   * `upsell` — what the next tier would have paid on this purchase.
   * `categories` — the other category rates the user's own tier pays.
   */
  kind: 'upsell' | 'categories';
  segments: CashbackFooterSegment[];
  linkLabel: string;
}

/** Everything the transaction screen's cashback card prints. */
export interface CashbackBreakdown {
  /** "+$2.00", or the status when there is no figure yet. */
  amountLabel: string;
  isIneligible: boolean;
  isSubscription: boolean;
  /** "Standard" / "AI subscription". */
  typeLabel: string;
  /** "3%" — omitted when no rate can be named honestly. */
  rateLabel?: string;
  /** "Core" / "Prime perk". */
  tierLabel?: string;
  timing?: CashbackTiming;
  footer?: CashbackFooter;
}

export interface CashbackBreakdownInput {
  info: CashbackInfo;
  /** The raw row, for the rate and dates `CashbackInfo` does not carry. */
  cashback?: Cashback;
  /** What the purchase cost in USD, for the upsell figure. */
  purchaseUsd: number | null;
  rewardsData?: RewardsUserData;
  tierBenefits?: TierBenefits[];
}

const isUsableNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const formatUsd = (value: number): string =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "A", "A and B", "A, B and C". */
const joinLabels = (labels: string[]): string =>
  labels.length < 2
    ? (labels[0] ?? '')
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

/**
 * The tier whose launch rate a stored tier-sourced rate matches.
 *
 * The row does not record the tier itself, and the user's tier today can differ
 * from the one they held at purchase — an upgrade during escrow would otherwise
 * label a 3% purchase "Prime".
 */
const tierForStoredRate = (cashback: Cashback | undefined, percentage: number | undefined) => {
  if (percentage === undefined || cashback?.cashbackPercentageSource !== 'Tier') return undefined;
  return (Object.keys(TIER_CASHBACK_RATES) as RewardsTier[]).find(
    tier => Math.abs(TIER_CASHBACK_RATES[tier] - percentage) < 0.001,
  );
};

const resolveTiming = (info: CashbackInfo, cashback?: Cashback): CashbackTiming | undefined => {
  if (info.isIneligible) return undefined;

  const payoutAt = info.payoutAt ?? cashback?.payoutAt;
  if (!payoutAt) return undefined;
  if (info.isPaid) return { kind: 'paid', paidAt: payoutAt };

  const payoutMs = new Date(payoutAt).getTime();
  const createdMs = cashback?.createdAt ? new Date(cashback.createdAt).getTime() : NaN;
  const holdDays = Math.round((payoutMs - createdMs) / DAY_MS);

  return {
    kind: 'releasing',
    payoutAt,
    holdDays: Number.isFinite(holdDays) && holdDays > 0 ? holdDays : undefined,
  };
};

/** "Prime would have paid you $4.00 on this purchase, plus 10% on subscriptions." */
const resolveUpsell = (
  tier: RewardsTier,
  earned: { usd: number; rate?: number },
  purchaseUsd: number | null,
  tierBenefits: TierBenefits[] | undefined,
): CashbackFooter | undefined => {
  const next = NEXT_TIER[tier];
  if (!next || !purchaseUsd) return undefined;

  const live = tierBenefits?.find(benefits => benefits.tier === next);
  const liveRate = live ? parseFloat(live.cardCashback.title) : undefined;
  const nextRate = resolveTierCashbackRate(next, liveRate, IS_TIER_CASHBACK_HARDCODED);
  const wouldHavePaid = Math.round(purchaseUsd * nextRate) / 100;

  // Nothing to sell when the next tier would not have paid more — a cardholder
  // on a custom rate, say, or a purchase too small to show a difference.
  if (earned.rate !== undefined && nextRate <= earned.rate) return undefined;
  if (wouldHavePaid < 0.01 || wouldHavePaid <= earned.usd + 0.004) return undefined;

  const nextSubscriptionRate = tierPresentationContent(next, live).subscriptionRate;

  return {
    kind: 'upsell',
    segments: [
      { text: `${TIER_LABELS[next]} would have paid you ` },
      { text: formatUsd(wouldHavePaid), highlight: true },
      {
        text: nextSubscriptionRate
          ? ` on this purchase, plus ${nextSubscriptionRate} on subscriptions. `
          : ' on this purchase. ',
      },
    ],
    linkLabel: 'Compare tiers',
  };
};

/**
 * "Prime also pays 10% on Streaming and Music, and 8% on Rides."
 *
 * Built from the categories the API still reports, so a category an admin has
 * switched off is not advertised on a receipt the day after it stopped paying.
 */
const resolveCategories = (
  tier: RewardsTier,
  subscriptionRate: number,
  excludeCategory: string | undefined,
  categoryRates: RewardsUserData['subscriptionCategoryRates'],
): CashbackFooter | undefined => {
  const { categories } = categoryCashbackPresentation(tier, subscriptionRate, categoryRates);
  const groups: { rate: number; labels: string[] }[] = [];

  // The API's list, labels and order — so a category added in the admin portal
  // is named here too, and one that was paused is not.
  for (const category of categories) {
    if (category.key === excludeCategory) continue;
    if (!category.rate) continue;
    const last = groups[groups.length - 1];
    if (last && last.rate === category.rate) last.labels.push(category.label);
    else groups.push({ rate: category.rate, labels: [category.label] });
  }

  if (!groups.length) return undefined;

  const segments: CashbackFooterSegment[] = [{ text: `${TIER_LABELS[tier]} also pays ` }];
  groups.forEach((group, index) => {
    if (index > 0) segments.push({ text: index === groups.length - 1 ? ', and ' : ', ' });
    segments.push({ text: formatCashbackRate(group.rate), highlight: true });
    segments.push({ text: ` on ${joinLabels(group.labels)}` });
  });
  segments.push({ text: '. ' });

  return { kind: 'categories', segments, linkLabel: 'See categories' };
};

/**
 * What the cashback card on a card transaction says (Figma 27704:3788 /
 * 27704:3904): the figure, which programme paid it and at what rate, the tier
 * behind it, when it pays, and one line on what more the user could earn.
 */
export const buildCashbackBreakdown = ({
  info,
  cashback,
  purchaseUsd,
  rewardsData,
  tierBenefits,
}: CashbackBreakdownInput): CashbackBreakdown => {
  const isSubscription = !!info.isSubscriptionDiscount;
  const amountLabel = info.isIneligible
    ? 'Ineligible'
    : (info.amount ?? (info.isEscrowed ? 'Escrowed' : 'Pending'));

  const currentTier = rewardsData?.currentTier;
  const subscriptionRate = isUsableNumber(rewardsData?.subscriptionDiscountRate)
    ? rewardsData.subscriptionDiscountRate
    : 0;

  let typeLabel: string;
  let rate: number | undefined;
  let rateLabel: string | undefined;
  let tierLabel: string | undefined;

  if (isSubscription) {
    const category = subscriptionCategoryLabel(info.subscriptionCategory);
    typeLabel = category ? `${category} subscription` : 'Subscription';
    // Subscription rows carry no rate of their own. The tier's perk rate is the
    // one that paid — as long as the user still holds a tier with the perk; a
    // downgraded user's tier today says nothing about this charge.
    if (currentTier && subscriptionRate > 0) {
      rateLabel = formatCashbackRate(subscriptionRate);
      tierLabel = `${TIER_LABELS[currentTier]} perk`;
    }
  } else {
    typeLabel = 'Standard';
    const storedRate = isUsableNumber(cashback?.cashbackPercentage)
      ? cashback.cashbackPercentage * 100
      : undefined;
    rate = storedRate ?? (rewardsData ? resolveUserCashbackRate(rewardsData) : undefined);
    if (rate !== undefined && rate > 0) rateLabel = formatCashbackRate(rate);
    const tier = tierForStoredRate(cashback, storedRate) ?? currentTier;
    if (tier) tierLabel = TIER_LABELS[tier];
  }

  let footer: CashbackFooter | undefined;
  if (currentTier && !info.isIneligible) {
    const earned = { usd: cashback ? getCashbackUsdValue(cashback) : 0, rate };
    footer =
      (!isSubscription
        ? resolveUpsell(currentTier, earned, purchaseUsd, tierBenefits)
        : undefined) ??
      resolveCategories(
        currentTier,
        subscriptionRate,
        isSubscription ? info.subscriptionCategory : undefined,
        rewardsData?.subscriptionCategoryRates,
      );
  }

  return {
    amountLabel,
    isIneligible: info.isIneligible,
    isSubscription,
    typeLabel,
    rateLabel,
    tierLabel,
    timing: resolveTiming(info, cashback),
    footer,
  };
};
