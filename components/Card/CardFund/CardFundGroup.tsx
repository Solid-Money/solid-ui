import React, { Children, Fragment, ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type CardFundGroupProps = {
  /** Section heading rendered above the card (e.g. "Stablecoins"). */
  label?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Rounded card that stacks `CardFundRow`s, hairline-divided, under an optional
 * section label.
 */
const CardFundGroup = ({ label, children, className }: CardFundGroupProps) => {
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View className={cn('gap-y-4', className)}>
      {label ? <Text className="text-base leading-4 text-white/50">{label}</Text> : null}
      <View className="overflow-hidden rounded-[15px] bg-card">
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View className="h-px bg-white/[0.06]" /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
};

export default CardFundGroup;
