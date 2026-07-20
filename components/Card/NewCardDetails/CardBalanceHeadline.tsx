import { TextStyle, View } from 'react-native';

import CountUp from '@/components/CountUp';
import { Text } from '@/components/ui/text';

// Same 50px Mona Sans treatment (greyed decimals) as the redesigned Wallet /
// Savings headlines, so the card screen matches.
const WHOLE_STYLE: TextStyle = {
  fontSize: 50,
  fontWeight: '500',
  fontFamily: 'MonaSans_500Medium',
  color: '#ffffff',
};
const DECIMAL_STYLE: TextStyle = { ...WHOLE_STYLE, color: '#666666' };
const SEPARATOR_STYLE: TextStyle = { ...WHOLE_STYLE };

interface CardBalanceHeadlineProps {
  /** Spendable card balance as a string (from cardDetails.balances.available.amount). */
  amount: string;
}

/** "Card Balance" label + big number, shown above the card image (whitelisted). */
const CardBalanceHeadline = ({ amount }: CardBalanceHeadlineProps) => {
  const value = Number.parseFloat(amount) || 0;

  return (
    <View className="items-center gap-1 pt-2">
      <Text className="text-base font-medium text-muted-foreground">Card Balance</Text>
      <CountUp
        prefix="$"
        count={value}
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

export default CardBalanceHeadline;
