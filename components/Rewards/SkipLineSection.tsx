import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAttributes } from '@/hooks/useRewards';
import { AttributeCategory } from '@/lib/types';

import RewardBenefit from './RewardBenefit';

const SkipLineSection = () => {
  const { data: attributes, isLoading } = useAttributes(AttributeCategory.FUSE);

  const skipLineMethods = attributes?.filter(attr => attr.enabled && attr.implemented) || [];

  return (
    <View className="gap-6 rounded-twice bg-card p-6 md:gap-10 md:p-10">
      <View className="gap-2">
        <Text className="text-2xl font-semibold text-rewards">Skip the line with FUSE</Text>
        <Text className="text-base opacity-70">
          Stake FUSE or hold it in your vault to immediately unlock higher membership tiers
        </Text>
      </View>
      {!isLoading && skipLineMethods.length > 0 && (
        <View className="flex-row flex-wrap gap-6">
          {skipLineMethods.map((method, index) => (
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
      <View className="flex-row gap-4">
        <Button
          variant="rewards"
          className="h-12 flex-1 rounded-xl bg-rewards web:hover:bg-rewards/90"
        >
          <Text className="font-bold">Stake FUSE</Text>
        </Button>
        <Button variant="secondary" className="h-12 flex-1 rounded-xl border-0">
          <Text className="font-bold">View FUSE Vault</Text>
        </Button>
      </View>
    </View>
  );
};

export default SkipLineSection;
