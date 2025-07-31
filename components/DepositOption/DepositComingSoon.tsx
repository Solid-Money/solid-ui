import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const DepositComingSoon = () => {
  return (
    <View className="px-2 py-1 bg-accent-foreground/20 rounded-lg">
      <Text className="text-sm text-primary font-semibold">Coming Soon</Text>
    </View>
  );
};

export default DepositComingSoon;
