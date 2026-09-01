import { View } from 'react-native';

import CardGlyph from '@/assets/images/card';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import getTokenIcon from '@/lib/getTokenIcon';
import { CardTransaction, CardTransactionCategory } from '@/lib/types';

type CardActivityIconProps = {
  transaction: Pick<CardTransaction, 'category' | 'currency'>;
  size?: number;
};

// The glyph's designed geometry inside the circle: 18 × 14.6 in a 44pt row icon
// (Figma 24781:8033). Kept as ratios so the same component can draw the 75pt
// avatar on a transaction's detail screen (Figma 21287:5884) without the glyph
// shrinking to a quarter of the circle it sits in.
const GLYPH_WIDTH_RATIO = 18 / 44;
const GLYPH_ASPECT_RATIO = 14.6 / 18;

/**
 * The leading icon on a card row (Figma 24781:8033).
 *
 * A spend gets the card glyph rather than the merchant's initials: in the merged
 * feed the icon is what tells a card row apart from a wallet row, and every
 * wallet row leads with a token. Funding rows keep their token icon — the money
 * came from a token the user chose, and that is the useful thing to show.
 */
export default function CardActivityIcon({ transaction, size = 44 }: CardActivityIconProps) {
  const isFunding = transaction.category === CardTransactionCategory.CRYPTO_FUNDING;

  if (isFunding) {
    return (
      <RenderTokenIcon
        tokenIcon={getTokenIcon({ tokenSymbol: transaction.currency?.toUpperCase(), size })}
        size={size}
      />
    );
  }

  const glyphWidth = size * GLYPH_WIDTH_RATIO;

  return (
    <View
      className="items-center justify-center rounded-full bg-[#333333]"
      style={{ width: size, height: size }}
    >
      <CardGlyph width={glyphWidth} height={glyphWidth * GLYPH_ASPECT_RATIO} />
    </View>
  );
}
