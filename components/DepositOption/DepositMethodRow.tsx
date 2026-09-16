import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';

type DepositMethodRowProps = {
  /** The method's icon cluster, rendered on its own line above the title. */
  icon: ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
};

/**
 * A row of the "Deposit with" chooser.
 *
 * Unlike `CardFundRow`, the icon sits above the title rather than beside it.
 * That is what the design asks for, and it is also what makes the row readable:
 * an icon cluster is far wider than a single glyph, and next to one the subtitle
 * was left with about 200px and wrapped onto two cramped lines.
 */
const DepositMethodRow = ({ icon, title, subtitle, onPress }: DepositMethodRowProps) => (
  <Pressable
    className="flex-row items-center gap-x-3 px-5 py-5 web:transition-colors web:hover:bg-card-hover"
    onPress={onPress}
  >
    <View className="flex-1 items-start gap-y-3">
      {icon}
      <View className="gap-y-1">
        <Text className="text-xl font-semibold leading-tight text-primary">{title}</Text>
        <Text className="text-sm leading-5 text-white/70">{subtitle}</Text>
      </View>
    </View>
    <ChevronRight color="white" size={20} />
  </Pressable>
);

export default DepositMethodRow;
