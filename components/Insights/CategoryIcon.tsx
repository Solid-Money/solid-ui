import { View } from 'react-native';
import {
  ArrowLeftRight,
  Briefcase,
  Car,
  Ellipsis,
  HeartPulse,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Ticket,
  Utensils,
} from 'lucide-react-native';

import { SPENDING_CATEGORIES, SpendingCategoryKey } from '@/lib/utils/spendingInsights';

const ICONS = {
  food: Utensils,
  shopping: ShoppingBag,
  transport: Car,
  groceries: ShoppingCart,
  subscriptions: Repeat,
  entertainment: Ticket,
  health: HeartPulse,
  bills: Receipt,
  transfers: ArrowLeftRight,
  business: Briefcase,
  other: Ellipsis,
} satisfies Record<SpendingCategoryKey, unknown>;

/** A category's glyph in its own colour, on a tint of that colour. */
export default function CategoryIcon({
  category,
  size = 37,
}: {
  category: SpendingCategoryKey;
  size?: number;
}) {
  const Icon = ICONS[category];
  const { color } = SPENDING_CATEGORIES[category];
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: `${color}29` }}
    >
      <Icon size={Math.round(size * 0.48)} color={color} strokeWidth={2} />
    </View>
  );
}
