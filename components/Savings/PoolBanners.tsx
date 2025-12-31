import { View } from 'react-native';

import PointsBanner from '@/components/Points/PointsBanner';
import PoolStat from '@/components/Savings/PoolStat';

const PoolBanners = () => {
  return (
    <View className="md:flex-row justify-between gap-8">
      <PoolStat />
      <PointsBanner />
    </View>
  );
};

export default PoolBanners;
