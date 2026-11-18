import { Pressable, StyleSheet, View } from 'react-native';

import {
  FlagEuIcon,
  FlagUsIcon,
  RadioSelectedIcon,
  RadioUnselectedIcon,
  TickIcon,
} from '@/components/Card/MainCurrency/icons';
import { MAIN_CURRENCY_LABEL } from '@/components/Card/MainCurrency/mainCurrencyCopy';
import { Text } from '@/components/ui/text';

import type { MainCurrency } from '@/lib/types';

interface CurrencyOptionCardProps {
  currency: MainCurrency;
  /** The balance in this currency — "$246.50", "€211.45". */
  balance: string;
  selected: boolean;
  /** What picking it means; shown only while selected. */
  lines: string[];
  onPress: () => void;
}

/**
 * One currency on the Main currency page (Figma 29236:9941, 29236:9977): flag, name and balance,
 * and once picked a green border and the three lines saying what the choice means.
 */
const CurrencyOptionCard = ({
  currency,
  balance,
  selected,
  lines,
  onPress,
}: CurrencyOptionCardProps) => (
  <Pressable
    accessibilityRole="radio"
    accessibilityState={{ checked: selected }}
    accessibilityLabel={`${MAIN_CURRENCY_LABEL[currency]}, ${balance}`}
    onPress={onPress}
    style={[styles.card, selected ? styles.selected : styles.unselected]}
  >
    <View style={styles.top}>
      {currency === 'EUR' ? <FlagEuIcon /> : <FlagUsIcon />}
      <View style={styles.text}>
        <Text className="text-[18px] font-medium text-white">{MAIN_CURRENCY_LABEL[currency]}</Text>
        <Text className="text-[14px] text-white/60">{balance}</Text>
      </View>
      {selected ? <RadioSelectedIcon /> : <RadioUnselectedIcon />}
    </View>

    {selected ? (
      <>
        <View style={styles.divider} />
        <View style={styles.lines}>
          {lines.map(line => (
            <View key={line} style={styles.line}>
              <TickIcon />
              <Text className="text-[15px] text-white/90">{line}</Text>
            </View>
          ))}
        </View>
      </>
    ) : null}
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1C',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  // The selected card's border is twice the other's; padding is trimmed by the difference so the
  // content does not shift when the selection moves.
  selected: { borderColor: '#94F27F', borderWidth: 2, paddingHorizontal: 19, paddingVertical: 17 },
  unselected: { borderColor: '#3A3A3A', borderWidth: 1 },
  top: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  text: { flex: 1, gap: 2 },
  // Figma: 16 spacer, 1pt divider, 16 spacer.
  divider: { backgroundColor: 'rgba(255, 255, 255, 0.08)', height: 1, marginVertical: 16 },
  lines: { gap: 12 },
  line: { alignItems: 'center', flexDirection: 'row', gap: 10 },
});

export default CurrencyOptionCard;
