import { View } from 'react-native';
import { CreditCard, Tag } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type FeatureItemProps = {
  icon: React.ReactNode;
  label: string;
};

const FeatureItem = ({ icon, label }: FeatureItemProps) => (
  <View className="flex-row items-center gap-2">
    <View className="h-9 w-9 items-center justify-center rounded-full bg-[#94F27F26]">{icon}</View>
    <Text className="text-xl font-medium">{label}</Text>
  </View>
);

const CashbackBadge = () => (
  <Text className="text-[11px] font-medium text-brand">3%</Text>
);

type SolidCardSummaryProps = {
  topUpLabel?: string;
  compact?: boolean;
  className?: string;
};

const SolidCardSummary = ({
  topUpLabel = 'Zero top-up & monthly fee',
  compact = false,
  className,
}: SolidCardSummaryProps) => {
  return (
    <View className={cn('gap-5', className)}>
      <View className="gap-2">
        <Text
          className={cn(
            'font-semibold',
            compact ? 'text-2xl' : 'text-3xl md:text-4.5xl',
          )}
        >
          Solid card
        </Text>
        <Text className="max-w-48 text-sm text-white/70 md:text-base">
          The essential card for your everyday needs.
        </Text>
      </View>
      <Text className="text-lg font-semibold text-brand">Free</Text>
      <View className={cn(compact ? 'gap-3' : 'flex-row flex-wrap gap-x-8 gap-y-3')}>
        <FeatureItem icon={<CreditCard size={16} color="#94F27F" />} label="Virtual card" />
        <FeatureItem icon={<CashbackBadge />} label="3% Cashback" />
        {compact && <FeatureItem icon={<Tag size={16} color="#94F27F" />} label={topUpLabel} />}
      </View>
      {!compact && <FeatureItem icon={<Tag size={16} color="#94F27F" />} label={topUpLabel} />}
    </View>
  );
};

export default SolidCardSummary;
