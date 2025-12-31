import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { View } from 'react-native';

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

export default function TimeGroupHeader({
  index,
  title,
  isPending,
  hasActivePendingTransactions,
}: TimeGroupHeaderProps) {
  return (
    <View className={cn('bg-background py-3', index > 0 && 'pt-6')}>
      {isPending ? (
        <View
          className={cn(
            'flex-row items-center justify-between',
            !hasActivePendingTransactions && 'justify-end',
          )}
        >
          {hasActivePendingTransactions && (
            <TooltipPopover
              trigger={<Header title={title} />}
              text="Updates automatically every few seconds"
            />
          )}
        </View>
      ) : (
        <Header title={title} />
      )}
    </View>
  );
}
