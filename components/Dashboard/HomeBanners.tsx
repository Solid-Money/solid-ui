import React, { useRef } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import Carousel, { ICarouselInstance, Pagination } from 'react-native-reanimated-carousel';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BANNER_HEIGHT = SCREEN_HEIGHT * 0.12;

const bannerData = [
  {
    id: '1',
    image: require('@/assets/images/deposit_banner.png'),
  },
  {
    id: '2',
    image: require('@/assets/images/deposit_banner.png'),
  },
  {
    id: '3',
    image: require('@/assets/images/deposit_banner.png'),
  },
  {
    id: '4',
    image: require('@/assets/images/deposit_banner.png'),
  },
];

export const HomeBanners = () => {
  const ref = useRef<ICarouselInstance>(null);
  const progress = useSharedValue<number>(0);

  const onPressPagination = (index: number) => {
    ref.current?.scrollTo({
      count: index - progress.value,
      animated: true,
    });
  };

  const renderItem = ({ item }) => {
    return (
      <View style={styles.bannerContainer}>
        <Image source={item.image} style={styles.bannerImage} resizeMode="contain" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Carousel
        ref={ref}
        width={SCREEN_WIDTH}
        height={BANNER_HEIGHT + 32}
        data={bannerData}
        scrollAnimationDuration={1000}
        onProgressChange={progress}
        renderItem={renderItem}
        modeConfig={{
          parallaxScrollingScale: 0.9,
          parallaxScrollingOffset: 50,
        }}
        style={styles.carousel}
      />
      <Pagination.Custom
        progress={progress}
        data={bannerData}
        dotStyle={styles.dotStyle}
        activeDotStyle={styles.activeDot}
        containerStyle={styles.paginationContainer}
        onPress={onPressPagination}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  carousel: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT + 32,
  },
  bannerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerImage: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 12,
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
