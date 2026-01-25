import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useAttributes } from '@/hooks/useRewards';
import { AttributeCategory } from '@/lib/types';

import RewardBenefit from './RewardBenefit';

const EarnPointsSection = () => {
  const { data: attributes, isLoading } = useAttributes(AttributeCategory.EARN);

  const earningMethods = attributes?.filter(attr => attr.enabled && attr.implemented) || [];

  return (
    <View className="gap-6 rounded-twice bg-card p-6 md:gap-10 md:p-10">
      <View className="gap-2">
        <Text className="text-2xl font-semibold text-rewards">How do you earn points?</Text>
        <Text className="text-base opacity-70">
          Earn points for every action you take with Solid and unlock rewards.{'\n'}
          Turn your deposits and referrals into points that unlock future rewards.
        </Text>
      </View>
      {!isLoading && earningMethods.length > 0 && (
        <View className="flex-row flex-wrap gap-6">
          {earningMethods.map((method, index) => (
            <View key={index} style={{ width: '48%' }}>
              <RewardBenefit
                icon={method.image}
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
