import { StyleSheet, View } from 'react-native';

import CurrencyOptionCard from '@/components/Card/MainCurrency/CurrencyOptionCard';
import { mainCurrencyLines } from '@/components/Card/MainCurrency/mainCurrencyCopy';
import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import { sheetBodyInset } from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

import type { MainCurrency } from '@/lib/types';

/** Figma 5b: 15 handle padding, the 5pt grabber, then 24 to the title. */
const SHEET_TOP = 44;
/** Figma 5b: 32 below Done. */
const SHEET_BOTTOM = 32;

/** What each card says under its name while it is not picked. */
const DEFAULT_CAPTION: Record<MainCurrency, string> = {
  EUR: 'Pay in euros by default',
  USD: 'Pay in dollars by default',
};

interface CardCurrencySheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selected: MainCurrency;
  /** The currency the country suggested, which leads the list and says so. */
  suggested: MainCurrency;
  /** "Germany", for "Suggested for Germany". */
  countryName?: string;
  onSelect: (currency: MainCurrency) => void;
}

/**
 * "Card currency" (Figma 5b · Change currency): the Main currency option cards, in a sheet over
 * the Approved screen. The pick is saved at activation as the Main currency, so it is the same
 * choice the Main currency page changes later — and Euro is what makes Activate turn on euro
 * payments in the same tap.
 */
export function CardCurrencySheet({
  isOpen,
  onOpenChange,
  selected,
  suggested,
  countryName,
  onSelect,
}: CardCurrencySheetProps) {
  const currencies: MainCurrency[] = suggested === 'EUR' ? ['EUR', 'USD'] : ['USD', 'EUR'];

  const caption = (currency: MainCurrency) =>
    currency === suggested && countryName
      ? `Suggested for ${countryName}`
      : DEFAULT_CAPTION[currency];

  return (
    <CardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      contentKey="card-currency"
      designTop={SHEET_TOP}
      designBottom={SHEET_BOTTOM}
    >
      {({ topPadding, presentation }) => (
        <View style={{ paddingTop: topPadding, paddingHorizontal: sheetBodyInset(presentation) }}>
          <Text className="text-center text-[20px] font-semibold text-white">Card currency</Text>
          <Text className="mt-1.5 text-center text-sm text-[#ACACAC]">
            You can change it anytime.
          </Text>

          <View style={styles.options}>
            {currencies.map(currency => (
              <CurrencyOptionCard
                key={currency}
                currency={currency}
                balance={caption(currency)}
                selected={selected === currency}
                // Activating with Euro turns EURC on, so the euro card can promise free euro
                // payments; the dollar card only once EURC is on, which it is not yet here.
                lines={mainCurrencyLines(currency, false)}
                onPress={() => onSelect(currency)}
              />
            ))}
          </View>

          <Button variant="brand" className="mt-6 w-full" onPress={() => onOpenChange(false)}>
            <Text>Done</Text>
          </Button>
        </View>
      )}
    </CardBottomSheet>
  );
}

const styles = StyleSheet.create({
  options: { gap: 12, marginTop: 24 },
});

export default CardCurrencySheet;
