import { TextStyle, View } from 'react-native';

import CountUp from '@/components/CountUp';
import { Text } from '@/components/ui/text';

// Big-number styling lifted from DashboardHeaderMobile so the headline matches
// the existing balance treatment (50px Mona Sans, greyed decimals).
const WHOLE_STYLE: TextStyle = {
  fontSize: 50,
  fontWeight: '500',
  fontFamily: 'MonaSans_500Medium',
  color: '#ffffff',
};
const DECIMAL_STYLE: TextStyle = { ...WHOLE_STYLE, color: '#666666' };
const SEPARATOR_STYLE: TextStyle = { ...WHOLE_STYLE };

interface WalletBalanceHeadlineProps {
  balance: number;
}

/**
 * "Wallet Balance" label + big number for the redesigned home screen.
 * `balance` is the wallet token balance (excludes soUSD/soFUSE); Card and
 * Savings live behind the OtherBalancesDropdown pill.
 */
const WalletBalanceHeadline = ({ balance }: WalletBalanceHeadlineProps) => {
  return (
    <View className="items-center gap-1 pt-2">
      <Text className="text-base font-medium text-muted-foreground">Wallet Balance</Text>
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

export default WalletBalanceHeadline;
