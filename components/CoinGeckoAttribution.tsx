import { Linking, Pressable } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** Where CoinGecko asks the attribution to link. */
export const COINGECKO_ATTRIBUTION_URL = 'https://www.coingecko.com/en/api';

interface CoinGeckoAttributionProps {
  className?: string;
}

/**
 * "Data provided by CoinGecko", linked to CoinGecko's API page.
 *
 * CoinGecko's paid plans license their prices on condition that the product
 * shows this wherever it displays them, and token prices here come in part
 * from CoinGecko, through the backend's shared cache. So it sits under every
 * list of priced tokens.
 */
export default function CoinGeckoAttribution({ className }: CoinGeckoAttributionProps) {
  return (
    <Pressable
      onPress={() => void Linking.openURL(COINGECKO_ATTRIBUTION_URL)}
      className={cn('self-center px-2 py-4 active:opacity-70', className)}
      accessibilityRole="link"
      accessibilityLabel="Price data provided by CoinGecko"
    >
      <Text className="text-xs text-white/40">Data provided by CoinGecko</Text>
    </Pressable>
  );
}
