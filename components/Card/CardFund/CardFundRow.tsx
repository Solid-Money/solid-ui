import React, { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type CardFundRowProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Pill labels (e.g. network names, "~3 min"). */
  chips?: string[];
  /** Chips sit on their own line under the title, or beside it. */
  chipsPosition?: 'below' | 'inline';
  /** Replaces the trailing chevron (e.g. a chevron-down on the network summary). */
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
};

/** Pill used for the network / rail labels inside a fund row. */
export const CardFundChip = ({ label }: { label: string }) => (
  <View className="rounded-[18px] bg-[#333333] px-2 py-[3px]">
    <Text className="text-sm leading-4 text-white/70">{label}</Text>
  </View>
);

/**
 * One tappable line inside a `CardFundGroup` card — icon, title, optional
 * subtitle or chips, and a trailing affordance.
 */
const CardFundRow = ({
  icon,
  title,
  subtitle,
  chips,
  chipsPosition = 'below',
  trailing,
  onPress,
  disabled,
  isLoading,
  className,
}: CardFundRowProps) => {
  const isDisabled = disabled || isLoading || !onPress;

  const renderChips = () =>
    chips?.length ? (
      <View className="flex-row flex-wrap items-center gap-1.5">
        {chips.map(chip => (
          <CardFundChip key={chip} label={chip} />
        ))}
      </View>
    ) : null;

  return (
    <Pressable
      className={cn(
        'flex-row items-center gap-x-3.5 px-[18px] py-4 web:transition-colors',
        !isDisabled && 'web:hover:bg-card-hover',
        className,
      )}
      onPress={onPress}
      disabled={isDisabled}
    >
      <View className="items-center justify-center">{icon}</View>
      <View className="flex-1 gap-y-1.5">
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
          <Text className="text-lg font-semibold leading-tight text-primary">{title}</Text>
          {chipsPosition === 'inline' ? renderChips() : null}
        </View>
        {subtitle ? <Text className="text-sm leading-4 text-white/70">{subtitle}</Text> : null}
        {chipsPosition === 'below' ? renderChips() : null}
      </View>
      {isLoading ? (
        <ActivityIndicator color="white" size={20} />
      ) : (
        (trailing ?? <ChevronRight color="white" size={20} />)
      )}
    </Pressable>
  );
};

export default CardFundRow;
