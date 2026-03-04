import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Linking, Platform, StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Carousel, { ICarouselInstance, Pagination } from 'react-native-reanimated-carousel';
import { CarouselRenderItemInfo } from 'react-native-reanimated-carousel/lib/typescript/types';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import PointsBanner from '@/components/Points/PointsBanner';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useDimension } from '@/hooks/useDimension';
import { fetchPromotionsBanner } from '@/lib/api';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

import CardBanner from './CardBanner';
import DepositBanner from './DepositBanner';
import { BannersFallback } from './LazyHomeBanners';
import { PanGestureProvider, usePanGesture } from './PanGestureContext';

import type { PanGesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

type BannerData = React.ReactElement[];

type BannerItemProps = {
  index: number;
  item: React.ReactElement;
  dataLen: number;
  hasMultipleViews: boolean;
  progress: SharedValue<number>;
  gapPadding: SharedValue<number>;
  bannerHeight: number;
};

const BannerItem = ({
  index,
  item,
  dataLen,
  hasMultipleViews,
  progress,
  gapPadding,
  bannerHeight,
}: BannerItemProps) => {
  const isWeb = Platform.OS === 'web';

  const animatedStyle = useAnimatedStyle(() => {
    const currentIndex = Math.round(progress.value);
    const nextIndex = (currentIndex + 1) % dataLen;

    if (hasMultipleViews) {
      const isCurrent = index === currentIndex;
      const isNext = index === nextIndex;
      return {
        paddingRight: isCurrent || !isWeb ? gapPadding.value : 0,
        paddingLeft: isNext || !isWeb ? gapPadding.value : 0,
      };
    }

    return {
      paddingRight: 0,
      paddingLeft: 0,
    };
  }, [index, dataLen, hasMultipleViews]);

  return <Animated.View style={[animatedStyle, { height: bannerHeight }]}>{item}</Animated.View>;
};

interface HomeBannersContentProps {
  data?: React.ReactElement[];
}

function getPromoBannerOnPress(
  item: { link?: string; slug: string },
  setModal: (m: (typeof DEPOSIT_MODAL)[keyof typeof DEPOSIT_MODAL]) => void,
): () => void {
  if (item.link?.trim()) {
    const link = item.link.trim();
    if (link.startsWith('http://') || link.startsWith('https://')) {
      return () => Linking.openURL(link);
    }
    return () => router.push(link as any);
  }
  switch (item.slug) {
    case 'deposit-from-your-bank-or-debit-card':
      return () => {
        useSavingStore.getState().selectVaultForDeposit(0);
        setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_OPTIONS);
      };
    default:
      return () => {};
  }
}

const PromoImageBanner = ({
  imageURL,
  onPress,
  height,
}: {
  imageURL: string;
  onPress: () => void;
  height: number;
}) => (
  <Pressable onPress={onPress} style={[styles.promoImageWrap, { height }]}>
    <Image source={{ uri: imageURL }} style={styles.promoImage} contentFit="contain" />
  </Pressable>
);

const HomeBannersContent = ({ data: propData }: HomeBannersContentProps) => {
  const ref = useRef<ICarouselInstance>(null);
  const progress = useSharedValue<number>(0);
  const { isScreenMedium } = useDimension();
  const [containerWidth, setContainerWidth] = useState(0);
  const gapPadding = useSharedValue(0);
  const isPanning = usePanGesture();
  const setModal = useDepositStore(s => s.setModal);
  const { data: cardStatus, isLoading } = useCardStatus();
  const { data: promotionsBanner, isLoading: isPromotionsBannerLoading } = useQuery({
    queryKey: ['promotions-banner'],
    queryFn: fetchPromotionsBanner,
    staleTime: 5 * 60 * 1000,
    enabled: !propData,
  });

  const GAP = isScreenMedium ? 30 : 8;
  const ITEM_WIDTH = isScreenMedium ? containerWidth / 2 : containerWidth;
  const VIEW_COUNT = isScreenMedium ? 2 : 1;
  const BANNER_HEIGHT = isScreenMedium ? 220 : 170;
  const HAS_MULTIPLE_VIEWS = VIEW_COUNT > 1;

  const defaultData = useMemo(() => {
    if (promotionsBanner?.length) {
      const sorted = [...promotionsBanner].sort((a, b) => a.sort - b.sort);
      return sorted.map((item, i) => (
        <PromoImageBanner
          key={`promo-${item.slug}-${i}`}
          imageURL={item.imageURL}
          onPress={getPromoBannerOnPress(item, setModal)}
          height={BANNER_HEIGHT}
        />
      ));
    }
    const fallback: React.ReactElement[] = [
      <PointsBanner key="points" />,
      <DepositBanner key="deposit" />,
    ];
    if (!isLoading && !cardStatus?.status) {
      fallback.unshift(<CardBanner key="card" />);
    }
    return fallback;
  }, [cardStatus, isLoading, promotionsBanner, setModal, BANNER_HEIGHT]);

  const data = propData ?? defaultData;
  const IS_PAGINATION = data.length > VIEW_COUNT;
  const MAX_INDEX = data.length - VIEW_COUNT;

  const paginationData = useMemo(
    () => (HAS_MULTIPLE_VIEWS ? data.slice(0, data.length - (VIEW_COUNT - 1)) : data),
    [data, HAS_MULTIPLE_VIEWS, VIEW_COUNT],
  );

  useEffect(() => {
    const target = HAS_MULTIPLE_VIEWS ? GAP / 2 : 0;
    // immediate update to avoid mount/responsive flicker
    gapPadding.value = withTiming(target, { duration: 0 });
  }, [HAS_MULTIPLE_VIEWS, GAP, gapPadding]);

  if (!propData && isPromotionsBannerLoading) {
    return <BannersFallback />;
  }

  const onPressPagination = (index: number) => {
    const targetIndex = Math.min(index, MAX_INDEX);
    ref.current?.scrollTo({
      count: targetIndex - progress.value,
      animated: true,
    });
  };

  const handleProgressChange = (_offsetProgress: number, absoluteProgress: number) => {
    progress.value = absoluteProgress;
    // Snap back if scrolled past max
    if (absoluteProgress > MAX_INDEX + 0.1) {
      ref.current?.scrollTo({ index: MAX_INDEX, animated: true });
    }
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
        bannerHeight={BANNER_HEIGHT}
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
            onProgressChange={handleProgressChange}
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
                scheduleOnRN(setPanning, false);
              });
              panGesture.onUpdate(event => {
                'worklet';
                // Only set panning if gesture moved significantly
                if (Math.abs(event.translationX) > 10 || Math.abs(event.translationY) > 10) {
                  scheduleOnRN(setPanning, true);
                }
              });
              panGesture.onFinalize(() => {
                'worklet';
                // Clear flag after a short delay to allow press handler to check
                scheduleOnRN(clearPanningDelayed);
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
              data={paginationData}
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

interface HomeBannersProps {
  data?: React.ReactElement[];
}

export const HomeBanners = ({ data }: HomeBannersProps = {}) => {
  return (
    <PanGestureProvider>
      <HomeBannersContent data={data} />
    </PanGestureProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  promoImageWrap: {
    borderRadius: 20,
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
  promoImage: {
    width: '100%',
    height: '100%',
  },
  paginationContainer: {
    gap: 4,
    marginTop: 0,
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

export default HomeBanners;
