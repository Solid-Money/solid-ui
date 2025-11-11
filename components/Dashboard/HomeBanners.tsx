import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Carousel, { ICarouselInstance, Pagination } from 'react-native-reanimated-carousel';
import { CarouselRenderItemInfo } from 'react-native-reanimated-carousel/lib/typescript/types';

import { useDimension } from '@/hooks/useDimension';
import CardBanner from './CardBanner';
import DepositBanner from './DepositBanner';
import PointsBanner from '@/components/Points/PointsBanner';
import ReferBanner from '@/components/Points/ReferBanner';

type BannerData = React.ReactElement[];

type BannerItemProps = {
  index: number;
  item: React.ReactElement;
  dataLen: number;
  hasMultipleViews: boolean;
  progress: SharedValue<number>;
  gapPadding: SharedValue<number>;
};

const BannerItem = ({
  index,
  item,
  dataLen,
  hasMultipleViews,
  progress,
  gapPadding,
}: BannerItemProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    const currentIndex = Math.round(progress.value);
    const nextIndex = (currentIndex + 1) % dataLen;

    if (hasMultipleViews) {
      const isCurrent = index === currentIndex;
      const isNext = index === nextIndex;
      return {
        paddingRight: isCurrent ? gapPadding.value : 0,
        paddingLeft: isNext ? gapPadding.value : 0,
      };
    }

    return {
      paddingRight: gapPadding.value,
      paddingLeft: gapPadding.value,
    };
  }, [index, dataLen, hasMultipleViews]);

  return (
    <Animated.View className="flex-1 h-full" style={animatedStyle}>
      {item}
    </Animated.View>
  );
};

export const HomeBanners = () => {
  const ref = useRef<ICarouselInstance>(null);
  const progress = useSharedValue<number>(0);
  const { isScreenMedium } = useDimension();
  const [containerWidth, setContainerWidth] = useState(0);
  const gapPadding = useSharedValue(0);

  const data = useMemo(
    () => [
      <ReferBanner key="refer" />,
      <PointsBanner key="points" />,
      <DepositBanner key="deposit" />,
      <CardBanner key="card" />,
    ],
    [],
  );

  const GAP = isScreenMedium ? 30 : 8;
  const ITEM_WIDTH = isScreenMedium ? containerWidth / 2 : containerWidth;
  const VIEW_COUNT = isScreenMedium ? 2 : 1;
  const BANNER_HEIGHT = isScreenMedium ? 220 : 170;
  const HAS_MULTIPLE_VIEWS = VIEW_COUNT > 1;
  const IS_PAGINATION = data.length > VIEW_COUNT;

  useEffect(() => {
    const target = HAS_MULTIPLE_VIEWS ? GAP / 2 : 0;
    // immediate update to avoid mount/responsive flicker
    gapPadding.value = withTiming(target, { duration: 0 });
  }, [HAS_MULTIPLE_VIEWS, GAP, gapPadding]);

  const onPressPagination = (index: number) => {
    ref.current?.scrollTo({
      count: index - progress.value,
      animated: true,
    });
  };

  const renderItem = ({ item, index }: CarouselRenderItemInfo<BannerData[number]>) => {
    return (
      <BannerItem
        key={index}
        index={index}
        item={item}
        dataLen={data.length}
        hasMultipleViews={HAS_MULTIPLE_VIEWS}
        progress={progress}
        gapPadding={gapPadding}
      />
    );
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      {containerWidth > 0 && (
        <>
          <Carousel
            key={`carousel-${containerWidth}`}
            enabled={IS_PAGINATION}
            ref={ref}
            width={ITEM_WIDTH}
            height={BANNER_HEIGHT}
            data={data}
            loop={IS_PAGINATION}
            autoPlay={false}
            onProgressChange={progress}
            scrollAnimationDuration={200}
            onScrollStart={() => {
              if (HAS_MULTIPLE_VIEWS) return;
              gapPadding.value = withTiming(GAP / 2, { duration: 100 });
            }}
            onScrollEnd={() => {
              if (HAS_MULTIPLE_VIEWS) return;
              gapPadding.value = withTiming(0, { duration: 100 });
            }}
            renderItem={renderItem}
            style={{
              width: containerWidth,
            }}
          />
          {IS_PAGINATION && (
            <Pagination.Custom
              progress={progress}
              data={data}
              dotStyle={styles.dotStyle}
              activeDotStyle={styles.activeDot}
              containerStyle={styles.paginationContainer}
              onPress={onPressPagination}
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  paginationContainer: {
    gap: 4,
    marginTop: 34,
  },
  dotStyle: {
    backgroundColor: '#C2C2C2',
    width: 10,
    height: 10,
    borderRadius: 50,
  },
  activeDot: {
    backgroundColor: '#C2C2C2',
    width: 20,
  },
});
