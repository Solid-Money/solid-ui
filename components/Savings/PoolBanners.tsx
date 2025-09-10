import { View } from 'react-native';

import ExtraYield from '@/components/Savings/ExtraYield';
import PoolStat from '@/components/Savings/PoolStat';

const PoolBanners = () => {
  return (
    <View className="md:flex-row justify-between gap-8">
      <PoolStat />
      <ExtraYield />
    </View>
  );
};

export default PoolBanners;
