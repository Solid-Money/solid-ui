import TooltipPopover from '@/components/Tooltip';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { View } from 'react-native';

interface SwitchStuckTransactionProps {
  showStuck: boolean;
  onToggle: (showStuck: boolean) => void;
}

const SwitchStuckTransaction = ({ showStuck, onToggle }: SwitchStuckTransactionProps) => {
  const handleToggle = (checked: boolean) => {
    onToggle(checked);
  };

  return (
    <TooltipPopover
      trigger={
        <View className="flex-row items-center gap-2">
          <Switch checked={showStuck} onCheckedChange={handleToggle} />
          <Text className="text-sm md:text-base text-muted-foreground">Stuck transactions</Text>
        </View>
      }
      text="Display transactions which are in pending state for more than 24 hours"
    />
  );
};

export default SwitchStuckTransaction;
