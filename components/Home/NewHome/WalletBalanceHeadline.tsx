import { TextStyle, View } from 'react-native';

import CountUp from '@/components/CountUp';
import { Text } from '@/components/ui/text';

// Big-number styling for the balance headline (45px Mona Sans Semibold,
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
 * "Balance" label + big number for the redesigned home screen.
 *
 * `balance` is everything the user holds — Wallet + Card + Savings (see
 * `getTotalBalance`) — combined for display only; the pill below opens the
 * breakdown that keeps them apart. It used to be Wallet + Card with Savings left
 * to the pill, which meant the biggest figure on the screen answered a question
 * ("what is in my wallet?") that nobody was asking at a glance, and the number the
 * user came for was the small one underneath it.
 */
const WalletBalanceHeadline = ({ balance }: WalletBalanceHeadlineProps) => {
  return (
    <View className="items-center gap-1 pt-2">
      <Text className="text-base font-medium text-muted-foreground">Balance</Text>
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
