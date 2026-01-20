import { View } from 'react-native';

import TooltipPopover from '@/components/Tooltip';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { cn } from '@/lib/utils';

import { DESKTOP_COLUMNS } from './columns';

const SKELETON_COUNT = 4;

// Skeleton color that's visible against dark bg-card (#1c1c1c)
const SKELETON_COLOR = '#3a3a3a';

/**
 * Mobile skeleton card - exact match to TokenCard structure
 */
const MobileSkeletonCard = () => (
  <View className="mb-2 flex-row items-center justify-between rounded-[20px] bg-[#1C1C1C] p-4 py-5">
    {/* Left side: icon + symbol */}
    <View className="flex-row items-center gap-3">
      {/* Icon 40x40 */}
      <Skeleton
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: SKELETON_COLOR,
        }}
      />
      <View>
        {/* Symbol text ~56px wide, 18px tall */}
        <Skeleton
          style={{
            width: 56,
            height: 18,
            borderRadius: 4,
            backgroundColor: SKELETON_COLOR,
          }}
        />
      </View>
    </View>

    {/* Right side: balance + USD */}
    <View className="flex-row items-center gap-3">
      <View className="items-end gap-1">
        {/* Balance */}
        <Skeleton
          style={{
            width: 64,
            height: 18,
            borderRadius: 4,
            backgroundColor: SKELETON_COLOR,
          }}
        />
        {/* USD value */}
        <Skeleton
          style={{
            width: 48,
            height: 14,
            borderRadius: 4,
            backgroundColor: SKELETON_COLOR,
          }}
        />
      </View>
    </View>
  </View>
);

/**
 * Desktop skeleton row - exact match to TokenRow structure
 */
interface DesktopSkeletonRowProps {
  index: number;
  totalCount: number;
}

const DesktopSkeletonRow = ({ index, totalCount }: DesktopSkeletonRowProps) => {
  const isFirst = index === 0;
  const isLast = index === totalCount - 1;

  return (
    <View
      className={cn(
        'flex-row items-center border-b border-border/40 bg-card',
        isFirst && 'rounded-t-twice',
        isLast && 'rounded-b-twice border-0',
      )}
    >
      {/* Asset Column */}
      <View className="p-6" style={{ width: DESKTOP_COLUMNS[0].width }}>
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-2">
            {/* Icon 34x34 */}
            <Skeleton
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: SKELETON_COLOR,
              }}
            />
            <View className="items-start">
              {/* Symbol text */}
              <Skeleton
                style={{
                  width: 56,
                  height: 16,
                  borderRadius: 4,
                  backgroundColor: SKELETON_COLOR,
                }}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Balance Column */}
      <View className="p-6" style={{ width: DESKTOP_COLUMNS[1].width }}>
        <View className="items-start gap-1">
          {/* Balance + symbol text */}
          <Skeleton
            style={{
              width: 120,
              height: 16,
              borderRadius: 4,
              backgroundColor: SKELETON_COLOR,
            }}
          />
          {/* USD value */}
          <Skeleton
            style={{
              width: 50,
              height: 14,
              borderRadius: 4,
              backgroundColor: SKELETON_COLOR,
            }}
          />
        </View>
      </View>

      {/* Price Column */}
      <View className="p-6" style={{ width: DESKTOP_COLUMNS[2].width }}>
        <View className="items-start">
          {/* Price text */}
          <Skeleton
            style={{
              width: 50,
              height: 16,
              borderRadius: 4,
              backgroundColor: SKELETON_COLOR,
            }}
          />
        </View>
      </View>

      {/* Action Column */}
      <View className="p-6" style={{ width: DESKTOP_COLUMNS[3].width }}>
        <View className="flex-row items-center justify-end">
          {/* Menu icon */}
          <Skeleton
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              backgroundColor: SKELETON_COLOR,
            }}
          />
        </View>
      </View>
    </View>
  );
};

/**
 * Desktop table header - matches TokenListDesktop header exactly
 */
const DesktopHeader = () => (
  <View className="flex-row py-2">
    <View className="px-6 py-2" style={{ width: DESKTOP_COLUMNS[0].width }}>
      <Text className="text-sm text-muted-foreground">{DESKTOP_COLUMNS[0].label}</Text>
    </View>
    <View className="px-6 py-2" style={{ width: DESKTOP_COLUMNS[1].width }}>
      <View className="flex-row items-center gap-1">
        <Text className="text-sm text-muted-foreground">{DESKTOP_COLUMNS[1].label}</Text>
        <TooltipPopover text="Balance without yield" />
      </View>
    </View>
    <View className="px-6 py-2" style={{ width: DESKTOP_COLUMNS[2].width }}>
      <Text className="text-sm text-muted-foreground">{DESKTOP_COLUMNS[2].label}</Text>
    </View>
    <View className="px-6 py-2" style={{ width: DESKTOP_COLUMNS[3].width }} />
  </View>
);

/**
 * Responsive skeleton loading UI for the token list
 */
const TokenListSkeleton = () => {
  const { isScreenMedium } = useDimension();

  if (!isScreenMedium) {
    return (
      <View>
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <MobileSkeletonCard key={index} />
        ))}
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ minHeight: 200 }}>
      <DesktopHeader />
      <View>
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <DesktopSkeletonRow key={index} index={index} totalCount={SKELETON_COUNT} />
        ))}
      </View>
    </View>
  );
};

export default TokenListSkeleton;
