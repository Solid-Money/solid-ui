import { View } from 'react-native';

import DashboardHeaderButtonsMobile from '@/components/Dashboard/DashboardHeaderButtonsMobile';
import SavingCountUp from '@/components/SavingCountUp';
import { SavingMode } from '@/lib/types';
import { fontSize } from '@/lib/utils';

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
        <SavingCountUp
          prefix="$"
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
              fontSize: fontSize(3),
              fontWeight: '600',
              //fontFamily: 'MonaSans_600SemiBold',
              color: '#ffffff',
              marginRight: -1,
            },
            decimalText: {
              fontSize: fontSize(3),
              fontWeight: '200',
              //fontFamily: 'MonaSans_600SemiBold',
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
