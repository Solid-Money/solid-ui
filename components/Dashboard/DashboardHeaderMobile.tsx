import { View } from 'react-native';

import SavingCountUp from '@/components/SavingCountUp';
import { Text } from '@/components/ui/text';
import { SavingMode } from '@/lib/types';
import { DashboardHeaderButtonsMobile } from '.';

interface DashboardHeaderMobileProps {
  balance: number;
  totalAPY?: number;
  lastTimestamp?: number;
  principal?: number;
  mode?: SavingMode;
}

const DashboardHeaderMobile = ({
  balance,
  totalAPY,
  lastTimestamp,
  principal,
  mode,
}: DashboardHeaderMobileProps) => {
  return (
    <View className="gap-10 mt-10">
      <View className="flex-row justify-center items-center">
        <Text className="text-6xl font-semibold">$</Text>
        <SavingCountUp
          balance={balance ?? 0}
          apy={totalAPY ?? 0}
          lastTimestamp={lastTimestamp ?? 0}
          principal={principal}
          mode={mode}
          classNames={{
            wrapper: 'text-foreground',
            decimalSeparator: 'text-2xl font-medium',
          }}
          styles={{
            wholeText: {
              fontSize: 60,
              fontWeight: '600',
              color: '#ffffff',
            },
            decimalText: {
              fontSize: 24,
              fontWeight: '500',
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
