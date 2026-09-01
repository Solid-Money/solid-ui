import { type ReactNode } from 'react';
import { type TextStyle, View } from 'react-native';

import CountUp from '@/components/CountUp';
import { Text } from '@/components/ui/text';

const WHOLE_STYLE: TextStyle = {
  fontSize: 45,
  fontWeight: '600',
  fontFamily: 'MonaSans_600SemiBold',
  color: '#ffffff',
};
const MUTED_DECIMAL_STYLE: TextStyle = {
  ...WHOLE_STYLE,
  color: 'rgba(255, 255, 255, 0.5)',
};

interface BalanceHeadlineProps {
  balance: number;
  label: string;
  mutedDecimals?: boolean;
}

/** Shared headline geometry for the Home and Earn balance summaries. */
export const BalanceHeadline = ({ balance, label, mutedDecimals = true }: BalanceHeadlineProps) => {
  const decimalStyle = mutedDecimals ? MUTED_DECIMAL_STYLE : WHOLE_STYLE;

  return (
    <View className="items-center gap-1 pt-2">
      <Text className="text-base font-medium text-muted-foreground">{label}</Text>
      <CountUp
        prefix="$"
        count={balance ?? 0}
        decimalPlaces={2}
        animateOnMount={false}
        classNames={{ wrapper: 'text-foreground' }}
        styles={{
          wholeText: WHOLE_STYLE,
          decimalText: decimalStyle,
          decimalSeparator: decimalStyle,
        }}
      />
    </View>
  );
};

/** Keeps the pill on the same vertical baseline beneath the shared headline. */
export const BalancePillRow = ({ children }: { children: ReactNode }) => (
  <View className="items-center" style={{ transform: [{ translateY: -10 }] }}>
    {children}
  </View>
);
