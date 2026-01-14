import { View } from 'react-native';

import { Text } from '@/components/ui/text';

import RewardBenefit from './RewardBenefit';

const EarnPointsSection = () => {
  const earningMethods = [
    {
      icon: 'images/dollar-yellow.png',
      title: 'Save',
      description: '1 point/hour for every $1 deposited',
    },
    {
      icon: 'images/dollar-yellow.png',
      title: 'Spend',
      description: '3000 points for every $1000 spent',
    },
    {
      icon: 'images/dollar-yellow.png',
      title: 'Invite friends',
      description: 'Earn 10% of their daily points',
    },
    {
      icon: 'images/dollar-yellow.png',
      title: 'Swap',
      description: '1000 points for each swap',
    },
  ];

  return (
    <View className="gap-6 rounded-twice bg-card p-6 md:gap-10 md:p-10">
      <View className="gap-2">
        <Text className="text-2xl font-semibold text-rewards">How do you earn points?</Text>
        <Text className="text-base opacity-70">
          Earn points for every action you take with Solid and unlock rewards.{'\n'}
          Turn your deposits and referrals into points that unlock future rewards.
        </Text>
      </View>
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
    </View>
  );
};

export default EarnPointsSection;
