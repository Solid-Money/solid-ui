import { View } from 'react-native';

import DashboardHeaderButtonsMobile from '@/components/Dashboard/DashboardHeaderButtonsMobile';
import SavingCountUp from '@/components/SavingCountUp';
import { Text } from '@/components/ui/text';
import { SavingMode } from '@/lib/types';

interface DashboardHeaderMobileProps {
  balance: number;
  totalAPY?: number;
  lastTimestamp?: number;
  mode?: SavingMode;
}

const DashboardHeaderMobile = ({
  balance,
  totalAPY,
  lastTimestamp,
  mode,
}: DashboardHeaderMobileProps) => {
  return (
    <View className="gap-10 mt-10">
      <View className="flex-row justify-center items-center">
        <Text className="text-[60px] sm:text-4xl font-medium">$</Text>
        <SavingCountUp
          balance={balance ?? 0}
          apy={totalAPY ?? 0}
          lastTimestamp={lastTimestamp ?? 0}
          mode={mode}
          classNames={{
            wrapper: 'text-foreground',
            decimalSeparator: 'text-2xl sm:text-lg font-medium',
          }}
          styles={{
            wholeText: {
              fontSize: 60,
              fontWeight: 'medium',
              fontFamily: 'MonaSans_500Medium',
              color: '#ffffff',
            },
            decimalText: {
              fontSize: 24,
              fontWeight: 'medium',
              fontFamily: 'MonaSans_500Medium',
              color: '#ffffff',
            },
          }}
        />
      </View>

      <DashboardHeaderButtonsMobile />
    </View>
  );
};

export default DashboardHeaderMobile;
