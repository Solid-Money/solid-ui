import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useRewardsConfig } from '@/hooks/useRewards';

import RewardBenefit from './RewardBenefit';

const EarnPointsSection = () => {
  const { data: config, isLoading } = useRewardsConfig();

  // Format earning methods based on config
  const getEarningMethods = () => {
    if (!config) {
      // Fallback values while loading
      return [
        {
          icon: 'images/dollar-yellow.png',
          title: 'Save',
          description: 'Earn points for deposits',
        },
        {
          icon: 'images/dollar-yellow.png',
          title: 'Spend',
          description: 'Earn points for spending',
        },
        {
          icon: 'images/dollar-yellow.png',
          title: 'Invite friends',
          description: 'Earn referral rewards',
        },
        { icon: 'images/dollar-yellow.png', title: 'Swap', description: 'Earn points for swaps' },
      ];
    }

    const { points, referral } = config;

    // Format holding funds description
    const holdingDesc = `${points.holdingFundsMultiplier} point/hour for every $1 deposited`;

    // Format card spend description (points per dollar * 1000 for every $1 spent)
    const spendPoints = points.cardSpendPointsPerDollar * 1000;
    const spendDesc = `${spendPoints.toLocaleString()} points per $1 spent`;

    // Format referral description
    const referralPercent = referral.recurringPercentage * 100;
    const referralDesc = `Earn ${referralPercent}% of their daily points`;

    // Format swap description (points per dollar for typical swap)
    const swapPoints = points.swapPointsPerDollar * 1000;
    const swapDesc = `${swapPoints.toLocaleString()} points per $1 swapped`;

    return [
      { icon: 'images/dollar-yellow.png', title: 'Save', description: holdingDesc },
      { icon: 'images/dollar-yellow.png', title: 'Spend', description: spendDesc },
      { icon: 'images/dollar-yellow.png', title: 'Invite friends', description: referralDesc },
      { icon: 'images/dollar-yellow.png', title: 'Swap', description: swapDesc },
    ];
  };

  const earningMethods = getEarningMethods();

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
            <View key={index} style={{ width: '48%' }}>
              <RewardBenefit
                icon={method.icon}
                title={method.title}
                description={method.description}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default EarnPointsSection;
