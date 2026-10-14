import React from 'react';
import { View } from 'react-native';

import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { TITLE_GROUPS } from '@/lib/utils/timeGrouping';

interface HeaderProps {
  title: string;
}

interface TimeGroupHeaderProps {
  index: number;
  title: string;
  isPending: boolean;
  showStuck?: boolean;
  onToggleStuck?: (showStuck: boolean) => void;
  hasActivePendingTransactions?: boolean;
  /** Less space above: the list already sits under its own heading (coin page). */
  compact?: boolean;
}

const Header = ({ title }: HeaderProps) => {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Text className="font-semibold text-muted-foreground">{title}</Text>
      </View>
    </View>
  );
};

export default React.memo(function TimeGroupHeader({
  title,
  isPending,
  hasActivePendingTransactions,
  compact,
}: TimeGroupHeaderProps) {
  const className = cn('bg-background pb-3', compact ? 'pt-3' : 'pt-6');
  return isPending && hasActivePendingTransactions ? (
    <View className={className}>
      <View className="flex-row items-center justify-between">
        <TooltipPopover
          trigger={<Header title={title} />}
          text="Updates automatically every few seconds"
        />
      </View>
    </View>
  ) : title !== TITLE_GROUPS.pending ? (
    <View className={className}>
      <Header title={title} />
    </View>
  ) : null;
});
