import React, { useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import Carousel, { ICarouselInstance, Pagination } from 'react-native-reanimated-carousel';
import { CarouselRenderItemInfo } from 'react-native-reanimated-carousel/lib/typescript/types';

import { useDimension } from '@/hooks/useDimension';
import CardBanner from './CardBanner';
import DepositBanner from './DepositBanner';

type BannerData = React.ReactElement[];

const data: BannerData = [<DepositBanner key="deposit" />, <CardBanner key="card" />];

export const HomeBanners = () => {
  const ref = useRef<ICarouselInstance>(null);
  const progress = useSharedValue<number>(0);
  const { isScreenMedium } = useDimension();
  const [containerWidth, setContainerWidth] = useState(0);

  const GAP = 40;
  const ITEM_WIDTH = isScreenMedium ? containerWidth / 2 : containerWidth;
  const VIEW_COUNT = isScreenMedium ? 2 : 1;
  const BANNER_HEIGHT = isScreenMedium ? 220 : 170;
  const HAS_MULTIPLE_VIEWS = VIEW_COUNT > 1;
  const IS_PAGINATION = data.length > VIEW_COUNT;

  const onPressPagination = (index: number) => {
    ref.current?.scrollTo({
      count: index - progress.value,
      animated: true,
    });
  };

  const renderItem = ({ item, index }: CarouselRenderItemInfo<BannerData[number]>) => {
    const i = ref.current?.getCurrentIndex() ?? 0;
    const isCurrentItem = HAS_MULTIPLE_VIEWS && index === i;
    const isNextItem = HAS_MULTIPLE_VIEWS && index === (i + 1) % data.length;

    return (
      <View
        className="flex-1 h-full"
        style={{ marginRight: isCurrentItem ? GAP / 2 : 0, marginLeft: isNextItem ? GAP / 2 : 0 }}
      >
        {item}
      </View>
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
            key={containerWidth}
            enabled={IS_PAGINATION}
            ref={ref}
            width={ITEM_WIDTH}
            height={BANNER_HEIGHT}
            data={data}
            loop={true}
            autoPlay={false}
            onProgressChange={progress}
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
