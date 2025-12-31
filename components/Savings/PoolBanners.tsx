import { View } from 'react-native';

import PointsBanner from '@/components/Points/PointsBanner';
import PoolStat from '@/components/Savings/PoolStat';

const PoolBanners = () => {
  return (
    <View className="justify-between gap-8 md:flex-row">
      <PoolStat />
      <PointsBanner />
    </View>
  );
};

export default PoolBanners;
