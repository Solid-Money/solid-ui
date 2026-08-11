import { ActivityIndicator, Platform, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { useRewardsConfig } from '@/hooks/useRewards';

import RewardBenefit from './RewardBenefit';

// Amount deposited counts toward Save points across every supported vault.
const SAVE_DEPOSIT_TOOLTIP = 'Amount deposited is calculated across the USDC, FUSE and ETH vaults';

// Card balance points accrue on the balance sitting on the card, separately
// from (and on top of) the points earned when that balance is spent.
const CARD_BALANCE_TOOLTIP =
  'Points accrue every hour on the balance available on your card, on top of the points you earn when you spend it';

// Default when the backend has not sent a rate yet: 1 point per $1 per hour.
const DEFAULT_CARD_BALANCE_POINTS_PER_HOUR = 1;

interface EarningMethod {
  icon: string;
  title: string;
  description: string;
  tooltip?: string;
  tooltipAnalyticsContext?: string;
}

const EarnPointsSection = () => {
  const { data: config, isLoading } = useRewardsConfig();
  const { isScreenMedium } = useDimension();

  // Format earning methods based on config
  const getEarningMethods = (): EarningMethod[] => {
    if (!config) {
      // Fallback values while loading
      return [
        {
          icon: 'images/save-yellow.png',
          title: 'Save',
          description: 'Earn points for deposits',
          tooltip: SAVE_DEPOSIT_TOOLTIP,
          tooltipAnalyticsContext: 'rewards_save_deposit_vaults',
        },
        {
          icon: 'images/spend-yellow.png',
          title: 'Spend',
          description: 'Earn points for spending',
        },
        {
          icon: 'images/dollar-yellow.png',
          title: 'Card balance',
          description: 'Earn points for the balance on your card',
          tooltip: CARD_BALANCE_TOOLTIP,
          tooltipAnalyticsContext: 'rewards_card_balance_holding',
        },
        {
          icon: 'images/invite-yellow.png',
          title: 'Invite friends',
          description: 'Earn referral rewards',
        },
        { icon: 'images/swap-yellow.png', title: 'Swap', description: 'Earn points for swaps' },
      ];
    }

    const { points, referral } = config;

    // Format holding funds description
    const holdingDesc = `${points.holdingFundsMultiplier} point/hour for every $1 deposited`;

    // Format card spend description (points per dollar for every $1 spent)
    const spendPoints = points.cardSpendPointsPerDollar;
    const spendDesc = `${spendPoints.toLocaleString()} points per $1 spent`;

    // Format card balance description, quoted per hour to match Save above.
    const cardBalancePoints =
      points.cardBalancePointsPerDollarPerHour ?? DEFAULT_CARD_BALANCE_POINTS_PER_HOUR;
    const cardBalanceDesc = `${cardBalancePoints.toLocaleString()} point/hour for every $1 on your card`;

    // Format referral description
    const referralPercent = referral.recurringPercentage * 100;
    const referralDesc = `Earn ${referralPercent}% of their daily points`;

    // Format swap description (points per dollar for typical swap)
    const swapPoints = points.swapPointsPerDollar;
    const swapDesc = `${swapPoints.toLocaleString()} points per $1 swapped`;

    return [
      {
        icon: 'images/save-yellow.png',
        title: 'Save',
        description: holdingDesc,
        tooltip: SAVE_DEPOSIT_TOOLTIP,
        tooltipAnalyticsContext: 'rewards_save_deposit_vaults',
      },
      { icon: 'images/spend-yellow.png', title: 'Spend', description: spendDesc },
      // Only advertise card balance points while the backend is accruing them;
      // the rate is behind a config switch for a staged rollout.
      ...(points.cardBalanceEnabled === false
        ? []
        : [
            {
              icon: 'images/dollar-yellow.png',
              title: 'Card balance',
              description: cardBalanceDesc,
              tooltip: CARD_BALANCE_TOOLTIP,
              tooltipAnalyticsContext: 'rewards_card_balance_holding',
            },
          ]),
      { icon: 'images/invite-yellow.png', title: 'Invite friends', description: referralDesc },
      { icon: 'images/swap-yellow.png', title: 'Swap', description: swapDesc },
    ];
  };

  // Swap is not available on iOS, so exclude it from the earning methods there.
  const earningMethods = getEarningMethods().filter(
    method => Platform.OS !== 'ios' || method.title !== 'Swap',
  );

  return (
    <View className="gap-6 rounded-twice bg-card p-6 md:gap-10 md:p-10">
      <View className="gap-2">
        <Text className="text-2xl font-semibold text-rewards">How do you earn points?</Text>
        <Text className="text-base opacity-70">
          Earn points for every action you take with Solid and unlock rewards
        </Text>
      </View>
      {isLoading ? (
        <View className="items-center justify-center py-8">
          <ActivityIndicator />
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-6">
          {earningMethods.map((method, index) => (
            <View key={index} style={{ width: isScreenMedium ? '48%' : '100%' }}>
              <RewardBenefit
                icon={method.icon}
                title={method.title}
                description={method.description}
                tooltip={method.tooltip}
                tooltipAnalyticsContext={method.tooltipAnalyticsContext}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default EarnPointsSection;
