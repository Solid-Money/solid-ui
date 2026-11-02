import { View } from 'react-native';

import { Text } from '@/components/ui/text';

/**
 * A stock's mark where the app has no logo for it (the stock vaults, their shares and
 * the stock tokens): its ticker on the 10% white circle the USD and EUR Yield glyphs
 * sit on. The app ships no company logos, and loads none from unknown hosts.
 */
const StockTickerIcon = ({
  ticker,
  size = 24,
  width = size,
}: {
  ticker: string;
  size?: number;
  /** YieldIcon's canvas is a touch wider than it is tall. */
  width?: number;
}) => (
  <View
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    className="items-center justify-center rounded-full"
    style={{ width, height: size, backgroundColor: 'rgba(255,255,255,0.1)' }}
  >
    <Text
      numberOfLines={1}
      style={{
        color: '#ffffff',
        fontWeight: '700',
        // Five letters (GOOGL) still fit inside the circle.
        fontSize: size * (ticker.length > 4 ? 0.22 : 0.26),
        letterSpacing: -0.2,
      }}
    >
      {ticker}
    </Text>
  </View>
);

export default StockTickerIcon;
