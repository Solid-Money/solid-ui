import { TextStyle, View } from 'react-native';

import CountUp from '@/components/CountUp';
import { Text } from '@/components/ui/text';

// Same big-number treatment as the redesigned home headline (50px Mona Sans,
// greyed decimals) so Wallet and Savings share one balance style.
const WHOLE_STYLE: TextStyle = {
  fontSize: 50,
  fontWeight: '500',
  fontFamily: 'MonaSans_500Medium',
  color: '#ffffff',
};
const DECIMAL_STYLE: TextStyle = { ...WHOLE_STYLE, color: '#666666' };
const SEPARATOR_STYLE: TextStyle = { ...WHOLE_STYLE };

interface SavingsBalanceHeadlineProps {
  balance: number;
}

/**
 * "Savings Balance" label + big number for the redesigned savings screen.
 * `balance` is the total redeemable savings value in USD (useTotalSavingsUSD).
 */
const SavingsBalanceHeadline = ({ balance }: SavingsBalanceHeadlineProps) => {
  return (
    <View className="items-center gap-1 pt-2">
      <Text className="text-base font-medium text-muted-foreground">Savings Balance</Text>
      <CountUp
        prefix="$"
        count={balance ?? 0}
        decimalPlaces={2}
        animateOnMount={false}
        classNames={{ wrapper: 'text-foreground' }}
        styles={{
          wholeText: WHOLE_STYLE,
          decimalText: DECIMAL_STYLE,
          decimalSeparator: SEPARATOR_STYLE,
        }}
      />
    </View>
  );
};

export default SavingsBalanceHeadline;
