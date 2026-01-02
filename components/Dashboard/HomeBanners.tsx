import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import type { PanGesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Carousel, { ICarouselInstance, Pagination } from 'react-native-reanimated-carousel';
import { CarouselRenderItemInfo } from 'react-native-reanimated-carousel/lib/typescript/types';

import PointsBanner from '@/components/Points/PointsBanner';
import { useDimension } from '@/hooks/useDimension';
import CardBanner from './CardBanner';
import DepositBanner from './DepositBanner';
import { PanGestureProvider, usePanGesture } from './PanGestureContext';

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
  const isWeb = Platform.OS === 'web';

  const animatedStyle = useAnimatedStyle(() => {
    // const currentIndex = Math.round(progress.value);
    // const nextIndex = (currentIndex + 1) % dataLen;

    if (hasMultipleViews) {
      // const isCurrent = index === currentIndex;
      // const isNext = index === nextIndex;
      return {
        paddingRight: gapPadding.value, //isCurrent ? gapPadding.value : 0,
        paddingLeft: gapPadding.value, //isNext ? gapPadding.value : 0,
      };
    }

    return {
      paddingRight: 16,
      paddingLeft: 16,
    };
  }, [index, dataLen, hasMultipleViews]);

  return (
    <Animated.View className="h-full flex-1" style={animatedStyle}>
      {item}
    </Animated.View>
  );
};

const HomeBannersContent = () => {
  const ref = useRef<ICarouselInstance>(null);
  const progress = useSharedValue<number>(0);
  const { isScreenMedium } = useDimension();
  const [containerWidth, setContainerWidth] = useState(0);
  const gapPadding = useSharedValue(0);
  const isPanning = usePanGesture();

  const data = useMemo(
    () => [
      <CardBanner key="card" />,
      <PointsBanner key="points" />,
      <DepositBanner key="deposit" />,
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

  if (!isPanning) {
    return null;
  }

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
            loop={false}
            autoPlay={false}
            onProgressChange={progress}
            scrollAnimationDuration={200}
            onScrollStart={() => {
              //  if (HAS_MULTIPLE_VIEWS) return;
              //gapPadding.value = withTiming(GAP / 2, { duration: 100 });
            }}
            onScrollEnd={() => {
              //if (HAS_MULTIPLE_VIEWS) return;
              //gapPadding.value = withTiming(0, { duration: 100 });
            }}
            onConfigurePanGesture={(panGesture: PanGesture) => {
              const setPanning = (value: boolean) => {
                isPanning.current = value;
              };
              const clearPanningDelayed = () => {
                setTimeout(() => {
                  isPanning.current = false;
                }, 100);
              };

              panGesture.onBegin(() => {
                'worklet';
                runOnJS(setPanning)(false);
              });
              panGesture.onUpdate(event => {
                'worklet';
                // Only set panning if gesture moved significantly
                if (Math.abs(event.translationX) > 10 || Math.abs(event.translationY) > 10) {
                  runOnJS(setPanning)(true);
                }
              });
              panGesture.onFinalize(() => {
                'worklet';
                // Clear flag after a short delay to allow press handler to check
                runOnJS(clearPanningDelayed)();
              });
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

export const HomeBanners = () => {
  return (
    <PanGestureProvider>
      <HomeBannersContent />
    </PanGestureProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  paginationContainer: {
    gap: 4,
    marginTop: 20,
  },
  dotStyle: {
    backgroundColor: '#616161',
    width: 9,
    height: 9,
    borderRadius: 50,
  },
  activeDot: {
    backgroundColor: '#B2B2B2',
    width: 20,
  },
});
