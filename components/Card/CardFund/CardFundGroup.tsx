import React, { Children, Fragment, ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** Matches the muted title/subtitle text the footer sits beside. */
const SHOW_MORE_ICON_COLOR = 'rgba(255,255,255,0.7)';

type CardFundGroupProps = {
  /** Section heading rendered above the card (e.g. "Stablecoins"). */
  label?: string;
  /**
   * Rows to show before a "Show more" footer takes over; the rest stay hidden
   * until it is tapped. Omit to always render every row.
   */
  maxVisibleRows?: number;
  children: ReactNode;
  className?: string;
};

const Divider = () => <View className="h-px bg-white/[0.06]" />;

/**
 * Rounded card that stacks `CardFundRow`s, hairline-divided, under an optional
 * section label.
 */
const CardFundGroup = ({ label, maxVisibleRows, children, className }: CardFundGroupProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const rows = Children.toArray(children).filter(Boolean);

  const isTruncated = maxVisibleRows !== undefined && rows.length > maxVisibleRows;
  const visibleRows = isTruncated && !isExpanded ? rows.slice(0, maxVisibleRows) : rows;

  return (
    <View className={cn('gap-y-4', className)}>
      {label ? <Text className="text-base leading-4 text-white/50">{label}</Text> : null}
      <View className="overflow-hidden rounded-[15px] bg-card">
        {visibleRows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <Divider /> : null}
            {row}
          </Fragment>
        ))}
        {isTruncated ? (
          <>
            <Divider />
            <Pressable
              className="flex-row items-center justify-center gap-x-2 px-[18px] py-4 web:transition-colors web:hover:bg-card-hover"
              onPress={() => setIsExpanded(previous => !previous)}
            >
              {isExpanded ? (
                <Minus size={16} color={SHOW_MORE_ICON_COLOR} />
              ) : (
                <Plus size={16} color={SHOW_MORE_ICON_COLOR} />
              )}
              <Text className="text-base font-medium leading-tight text-white/70">
                {isExpanded ? 'Show less' : 'Show more'}
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
};

export default CardFundGroup;
