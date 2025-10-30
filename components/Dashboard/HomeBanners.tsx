import React, { useRef, useState } from 'react';
import { Dimensions, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import Carousel, { ICarouselInstance, Pagination } from 'react-native-reanimated-carousel';

import { useDimension } from '@/hooks/useDimension';
import PoolStat from '@/components/Savings/PoolStat';
import DepositBanner from './DepositBanner';
import CardBanner from './CardBanner';

type BannerData = React.ReactElement[];

type BannerItem = {
  item: BannerData[number];
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const data: BannerData = [
  <DepositBanner key="deposit" />,
  <CardBanner key="card" />,
  <PoolStat key="pool" />,
];

// Won't be used until we have more than one banner
export const HomeBanners = () => {
  const ref = useRef<ICarouselInstance>(null);
  const progress = useSharedValue<number>(0);
  const { isScreenMedium } = useDimension();
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - 32);

  const GAP = 16;
  const ITEM_WIDTH = isScreenMedium ? (containerWidth - GAP) / 2 : containerWidth;
  const BANNER_HEIGHT = isScreenMedium ? 220 : 170;

  const onPressPagination = (index: number) => {
    ref.current?.scrollTo({
      count: index - progress.value,
      animated: true,
    });
  };

  const renderItem = ({ item }: BannerItem) => {
    return <View className="flex-1 w-full h-full">{item}</View>;
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Carousel
        ref={ref}
        width={ITEM_WIDTH}
        height={BANNER_HEIGHT}
        data={data}
        loop={false}
        autoPlay={false}
        scrollAnimationDuration={1000}
        windowSize={2}
        customConfig={() => ({ type: 'positive', viewCount: 2 })}
        onProgressChange={progress}
        renderItem={renderItem}
        style={{
          width: '100%',
        }}
      />
      {data.length > 1 && (
        <Pagination.Custom
          progress={progress}
          data={data}
          dotStyle={styles.dotStyle}
          activeDotStyle={styles.activeDot}
          containerStyle={styles.paginationContainer}
          onPress={onPressPagination}
        />
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
