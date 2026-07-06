import { View } from 'react-native';

import DashboardHeaderButtonsMobile from '@/components/Dashboard/DashboardHeaderButtonsMobile';
import SavingCountUp from '@/components/SavingCountUp';
import { useDimension } from '@/hooks/useDimension';
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
  const { isScreenMedium } = useDimension();

  return (
    <View className="gap-8">
      <View className="flex-row items-center justify-center pt-1">
        <SavingCountUp
          prefix="$"
          balance={balance ?? 0}
          apy={totalAPY ?? 0}
          lastTimestamp={lastTimestamp ?? 0}
          mode={mode}
          decimalPlaces={decimalPlaces}
          animateOnMount={false}
          classNames={{
            wrapper: 'text-foreground',
          }}
          styles={{
            wholeText: {
              fontSize: 50,
              fontWeight: '500',
              fontFamily: 'MonaSans_500Medium',
              color: '#ffffff',
            },
            decimalText: {
              fontSize: isScreenMedium ? 50 : 50,
              fontWeight: isScreenMedium ? '500' : '500',
              fontFamily: isScreenMedium ? 'MonaSans_500Medium' : 'MonaSans_500Medium',
              color: '#666666',
            },
            decimalSeparator: {
              fontSize: isScreenMedium ? 50 : 50,
              fontWeight: isScreenMedium ? '500' : '500',
              fontFamily: isScreenMedium ? 'MonaSans_500Medium' : 'MonaSans_500Medium',
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
