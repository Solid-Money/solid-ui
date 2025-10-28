import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { View } from 'react-native';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  isPending: boolean;
}

interface TimeGroupHeaderProps {
  index: number;
  title: string;
  isPending: boolean;
  showStuck?: boolean;
  onToggleStuck?: (showStuck: boolean) => void;
  hasActivePendingTransactions?: boolean;
}

const Header = ({ title, isPending }: HeaderProps) => {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Text className="font-semibold text-muted-foreground">{title}</Text>
        {isPending && <View className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />}
      </View>
    </View>
  );
};

export default function TimeGroupHeader({
  index,
  title,
  isPending,
  hasActivePendingTransactions,
}: TimeGroupHeaderProps) {
  return (
    <View className={cn('py-3 bg-background', index > 0 && 'pt-6')}>
      {isPending ? (
        <View
          className={cn(
            'flex-row justify-between items-center',
            !hasActivePendingTransactions && 'justify-end',
          )}
        >
          {hasActivePendingTransactions && (
            <TooltipPopover
              trigger={<Header title={title} isPending={isPending} />}
              text="Updates automatically every few seconds"
            />
          )}
        </View>
      ) : (
        <Header title={title} isPending={isPending} />
      )}
    </View>
  );
}
