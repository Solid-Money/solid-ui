import { View } from 'react-native';

import { Text } from '@/components/ui/text';

const DepositComingSoon = () => {
  return (
    <View className="rounded-lg bg-accent-foreground/20 px-2 py-1">
      <Text className="hidden text-sm font-semibold text-primary md:block">Coming Soon</Text>
      <Text className="block text-sm font-semibold text-primary md:hidden">Soon</Text>
    </View>
  );
};

export default DepositComingSoon;
