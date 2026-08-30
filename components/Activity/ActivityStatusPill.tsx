import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type ActivityStatusTone = 'neutral' | 'danger';

type ActivityStatusPillProps = {
  label: string;
  /** `danger` is the red treatment a declined card purchase gets. */
  tone?: ActivityStatusTone;
  className?: string;
};

/**
 * The small status chip on an activity row — "Pending" (Figma 24781:7724) and
 * "Declined" (Figma 24781:7993).
 */
export default function ActivityStatusPill({
  label,
  tone = 'neutral',
  className,
}: ActivityStatusPillProps) {
  return (
    <View
      className={cn(
        'self-start rounded-full px-[13px] py-[3px]',
        tone === 'danger' ? 'bg-[#523535]' : 'bg-[#333333]',
        className,
      )}
    >
      <Text
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
