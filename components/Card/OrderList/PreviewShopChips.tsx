import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

import type { SpendOrderPreviewShop } from '@/hooks/useSpendOrder';

const SHOPS: { shop: SpendOrderPreviewShop; label: string }[] = [
  { shop: 'USD', label: 'Dollar shop' },
  { shop: 'EUR', label: 'Euro shop' },
  { shop: 'OTHER', label: 'Other currency' },
];

interface PreviewShopChipsProps {
  shop: SpendOrderPreviewShop;
  onShopChange: (shop: SpendOrderPreviewShop) => void;
}

/**
 * "Dollar shop / Euro shop / Other currency" (Figma 30971:15315): the kind of shop an order
 * screen's preview prices its sample purchase at. Shared by the Spend order and Collateral order
 * previews.
 */
const PreviewShopChips = ({ shop, onShopChange }: PreviewShopChipsProps) => (
  <View style={styles.chips}>
    {SHOPS.map(({ shop: option, label }) => {
      const selected = option === shop;
      return (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={`Preview a ${label.toLowerCase()} purchase`}
          className="active:opacity-80"
          onPress={() => onShopChange(option)}
          style={[styles.chip, selected ? styles.chipSelected : styles.chipIdle]}
        >
          <Text
            className={cn(
              'text-[14px] font-semibold leading-[18px]',
              selected ? 'text-black' : 'text-white',
            )}
          >
            {label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7 },
  chipSelected: { backgroundColor: '#FFFFFF' },
  chipIdle: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
});

export default PreviewShopChips;
