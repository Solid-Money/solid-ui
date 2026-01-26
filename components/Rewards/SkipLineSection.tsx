import { View, ActivityIndicator } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useRewardsConfig } from '@/hooks/useRewards';

import RewardBenefit from './RewardBenefit';

const SkipLineSection = () => {
  const { data: config, isLoading } = useRewardsConfig();

  // Format FUSE staking methods based on config
  const getSkipLineMethods = () => {
    if (!config) {
      // Fallback values while loading
      return [
        { icon: 'images/dollar-yellow.png', title: 'Unlock Builder', description: 'Loading...' },
        { icon: 'images/dollar-yellow.png', title: 'Unlock Operator', description: 'Loading...' },
      ];
    }

    const { fuseStaking } = config;

    return [
      {
        icon: 'images/dollar-yellow.png',
        title: 'Unlock Builder',
        description: `${fuseStaking.tier2Amount.toLocaleString()} FUSE`,
      },
      {
        icon: 'images/dollar-yellow.png',
        title: 'Unlock Operator',
        description: `${fuseStaking.tier3Amount.toLocaleString()} FUSE`,
      },
    ];
  };

  const skipLineMethods = getSkipLineMethods();

  return (
    <View className="gap-6 rounded-twice bg-card p-6 md:gap-10 md:p-10">
      <View className="gap-2">
        <Text className="text-2xl font-semibold text-rewards">Skip the line with FUSE</Text>
        <Text className="text-base opacity-70">
          Stake FUSE or hold it in your vault to immediately unlock higher membership tiers
        </Text>
      </View>
      {isLoading ? (
        <View className="items-center justify-center py-8">
          <ActivityIndicator />
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-6">
          {skipLineMethods.map((method, index) => (
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
