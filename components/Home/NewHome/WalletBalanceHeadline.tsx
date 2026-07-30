import { TextStyle, View } from 'react-native';

import CountUp from '@/components/CountUp';
import { Text } from '@/components/ui/text';

// Big-number styling for the wallet balance headline (45px Mona Sans Semibold,
// with the decimal portion shown at 50% white).
const WHOLE_STYLE: TextStyle = {
  fontSize: 45,
  fontWeight: '600',
  fontFamily: 'MonaSans_600SemiBold',
  color: '#ffffff',
};
const DECIMAL_STYLE: TextStyle = { ...WHOLE_STYLE, color: 'rgba(255, 255, 255, 0.5)' };
const SEPARATOR_STYLE: TextStyle = { ...DECIMAL_STYLE };

interface WalletBalanceHeadlineProps {
  balance: number;
}

/**
 * "Wallet Balance" label + big number for the redesigned home screen.
 * `balance` is Wallet + Card combined (see getSpendableTotal) — the two are
 * added up for display only and broken out in the balances sheet. Savings is
 * excluded; it lives behind the OtherBalancesDropdown pill.
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
