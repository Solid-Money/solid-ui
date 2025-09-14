import React, { useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import Carousel, { ICarouselInstance, Pagination } from 'react-native-reanimated-carousel';

import HomeBannerDeposit from './HomeBannerDeposit';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = 90;

// Won't be used until we have more than one banner
export const HomeBanners = () => {
  const ref = useRef<ICarouselInstance>(null);
  const progress = useSharedValue<number>(0);
  const data = [1];

  const onPressPagination = (index: number) => {
    ref.current?.scrollTo({
      count: index - progress.value,
      animated: true,
    });
  };

  const renderItem = () => {
    return <HomeBannerDeposit />;
  };

  return (
    <View style={styles.container}>
      <Carousel
        ref={ref}
        width={SCREEN_WIDTH - 32}
        height={BANNER_HEIGHT}
        data={data}
        loop={false}
        autoPlay={false}
        scrollAnimationDuration={1000}
        onProgressChange={progress}
        renderItem={renderItem}
        modeConfig={{
          parallaxScrollingScale: 0.9,
          parallaxScrollingOffset: 50,
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
    gap: SCREEN_WIDTH * 0.012,
  },
  dotStyle: {
    backgroundColor: '#C2C2C2',
    width: SCREEN_WIDTH * 0.015,
    height: SCREEN_WIDTH * 0.015,
    borderRadius: 50,
  },
  activeDot: {
    backgroundColor: '#C2C2C2',
    width: SCREEN_WIDTH * 0.03,
  },
});
