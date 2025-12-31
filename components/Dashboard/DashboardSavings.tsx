import { View } from 'react-native';

import SavingCountUp from '@/components/SavingCountUp';
import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { SavingMode } from '@/lib/types';

type DashboardSavingsProps = {
  balance: number;
  totalAPY?: number;
  firstDepositTimestamp?: number;
  originalDepositAmount?: number;
  mode?: SavingMode;
  tooltipText?: string;
};

const DashboardSavings = ({
  balance,
  totalAPY,
  firstDepositTimestamp,
  mode = SavingMode.TOTAL_USD,
  tooltipText,
}: DashboardSavingsProps) => {
  const { isScreenMedium } = useDimension();
  return (
    <View className="flex-row items-center">
      <Text className="text-5xl font-medium text-foreground md:text-8xl">$</Text>
      <SavingCountUp
        balance={balance}
        apy={totalAPY ?? 0}
        lastTimestamp={firstDepositTimestamp ?? 0}
        mode={mode}
        classNames={{
          wrapper: 'text-foreground',
          decimalSeparator: 'text-2xl md:text-4.5xl font-medium',
        }}
        styles={{
          wholeText: {
            fontSize: isScreenMedium ? 96 : 48,
            fontWeight: 'medium',
            fontFamily: 'MonaSans_500Medium',
            color: '#ffffff',
            marginRight: -2,
          },
          decimalText: {
            fontSize: isScreenMedium ? 40 : 24,
            fontWeight: 'medium',
            fontFamily: 'MonaSans_500Medium',
            color: '#ffffff',
          },
        }}
      />
      {tooltipText && <TooltipPopover text={tooltipText} />}
    </View>
  );
};

export default DashboardSavings;
