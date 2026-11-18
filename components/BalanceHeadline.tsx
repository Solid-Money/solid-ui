import { type TextStyle, View } from 'react-native';

import CountUp from '@/components/CountUp';
import { Text } from '@/components/ui/text';

export const BALANCE_VALUE_STYLE: TextStyle = {
  fontSize: 45,
  fontWeight: '600',
  fontFamily: 'MonaSans_600SemiBold',
  color: '#ffffff',
};
export const MUTED_BALANCE_VALUE_STYLE: TextStyle = {
  ...BALANCE_VALUE_STYLE,
  color: 'rgba(255, 255, 255, 0.5)',
};

interface BalanceAmountProps {
  balance: number;
  mutedDecimals?: boolean;
  /** The currency symbol; `balance` must already be in that currency. */
  symbol?: string;
}

export const BalanceAmount = ({
  balance,
  mutedDecimals = true,
  symbol = '$',
}: BalanceAmountProps) => {
  const decimalStyle = mutedDecimals ? MUTED_BALANCE_VALUE_STYLE : BALANCE_VALUE_STYLE;

  return (
    <CountUp
      prefix={symbol}
      count={balance ?? 0}
      decimalPlaces={2}
      animateOnMount={false}
      classNames={{ wrapper: 'text-foreground' }}
      styles={{
        wholeText: BALANCE_VALUE_STYLE,
        decimalText: decimalStyle,
        decimalSeparator: decimalStyle,
      }}
    />
  );
};

export const BalanceHeadline = ({ label, ...amount }: BalanceAmountProps & { label: string }) => (
  <View className="items-center gap-1 pt-2">
    <Text className="text-base font-medium text-muted-foreground">{label}</Text>
    <BalanceAmount {...amount} />
  </View>
);
