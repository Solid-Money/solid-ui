import TooltipPopover from '@/components/Tooltip';
import { Text } from '@/components/ui/text';
import { TITLE_GROUPS } from '@/lib/utils/timeGrouping';
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
  title,
  isPending,
  hasActivePendingTransactions,
}: TimeGroupHeaderProps) {
  return isPending && hasActivePendingTransactions ? (
    <View className="bg-background pb-3 pt-6">
      <View className="flex-row items-center justify-between">
        <TooltipPopover
          trigger={<Header title={title} />}
          text="Updates automatically every few seconds"
        />
      </View>
    </View>
  ) : title !== TITLE_GROUPS.pending ? (
    <View className="bg-background pb-3 pt-6">
      <Header title={title} />
    </View>
  ) : null;
}
