import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type ActivityStatusTone = 'neutral' | 'danger';

type ActivityStatusPillProps = {
  label: string;
  /** `danger` is the red treatment a declined card purchase gets. */
  tone?: ActivityStatusTone;
  className?: string;
  /**
   * Truncate the label rather than let it wrap. A status is a word and never
   * needs this; a merchant location wears the same chip and can run long enough
   * to turn it into a two-line block.
   */
  numberOfLines?: number;
};

/**
 * The small status chip on an activity row — "Pending" (Figma 24781:7724) and
 * "Declined" (Figma 24781:7993). Also carries a card purchase's location, which
 * reads as the same kind of aside about the row above it.
 */
export default function ActivityStatusPill({
  label,
  tone = 'neutral',
  className,
  numberOfLines,
}: ActivityStatusPillProps) {
  return (
    <View
      className={cn(
        'max-w-full self-start rounded-full px-[13px] py-[3px]',
        tone === 'danger' ? 'bg-[#523535]' : 'bg-[#333333]',
        className,
      )}
    >
      <Text
        numberOfLines={numberOfLines}
        className={cn(
          'text-sm font-medium',
          tone === 'danger' ? 'text-[#F27F81]' : 'text-white/70',
        )}
      >
        {label}
      </Text>
    </View>
  );
}
