import { View } from 'react-native';

import DashboardHeaderButtonsMobile from '@/components/Dashboard/DashboardHeaderButtonsMobile';
import SavingCountUp from '@/components/SavingCountUp';
import { SavingMode } from '@/lib/types';

interface DashboardHeaderMobileProps {
  balance: number;
  totalAPY?: number;
  lastTimestamp?: number;
  mode?: SavingMode;
  decimalPlaces?: number;
}

const DashboardHeaderMobile = ({
  balance,
  totalAPY,
  lastTimestamp,
  mode,
  decimalPlaces = 2,
}: DashboardHeaderMobileProps) => {
  return (
    <View className="gap-8">
      <View className="flex-row items-center justify-center pb-6 pt-20">
        <SavingCountUp
          prefix="$"
          balance={balance ?? 0}
          apy={totalAPY ?? 0}
          lastTimestamp={lastTimestamp ?? 0}
          mode={mode}
          decimalPlaces={decimalPlaces}
          classNames={{
            wrapper: 'text-foreground',
          }}
          styles={{
            wholeText: {
              fontSize: 60,
              fontWeight: '600',
              fontFamily: 'MonaSans_600SemiBold',
              color: '#ffffff',
            },
            decimalText: {
              fontSize: 60,
              fontWeight: '600',
              fontFamily: 'MonaSans_600SemiBold',
              color: '#ffffff',
            },
            decimalSeparator: {
              fontSize: 60,
              fontWeight: '600',
              fontFamily: 'MonaSans_600SemiBold',
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
