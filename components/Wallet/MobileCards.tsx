import React, { useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Card, SavingCard, WalletCard } from '@/components/Wallet';
import { USDC_TOKEN_BALANCE } from '@/constants/tokens';
import { TokenBalance } from '@/lib/types';

type MobileCardsProps = {
  totalUSDExcludingSoUSD: number;
  topThreeTokens: TokenBalance[];
  isLoadingTokens: boolean;
  userHasCard: boolean;
  cardBalance: number;
};

export default function MobileCards({
  totalUSDExcludingSoUSD,
  topThreeTokens,
  isLoadingTokens,
  userHasCard,
  cardBalance,
}: MobileCardsProps) {
  const { width: screenWidth } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollX, setScrollX] = useState(0);

  const slidesPerView = 1.5;
  const cardWidth = screenWidth / slidesPerView;
  const gap = 16;
  const cardWithGap = cardWidth + gap;

  const cards = useMemo(
    () =>
      [
        <WalletCard
          key="wallet"
          balance={totalUSDExcludingSoUSD}
          className="h-full w-full"
          tokens={topThreeTokens}
          isLoading={isLoadingTokens}
          decimalPlaces={2}
        />,
        userHasCard ? (
          <Card
            key="card"
            balance={cardBalance}
            className="h-full w-full"
            tokens={[USDC_TOKEN_BALANCE]}
            isLoading={isLoadingTokens}
            decimalPlaces={2}
          />
        ) : null,
        <SavingCard key="saving" className="h-full w-full" decimalPlaces={2} />,
      ].filter(Boolean),
    [totalUSDExcludingSoUSD, topThreeTokens, isLoadingTokens, userHasCard, cardBalance],
  );

  const totalCards = cards.length;
  const paddingHorizontal = 16;
  const contentWidth = 2 * paddingHorizontal + totalCards * cardWidth + (totalCards - 1) * gap;
  const maxScrollX = Math.max(0, contentWidth - screenWidth);
  const showLeftBlur = scrollX > 10;
  const showRightBlur = totalCards > 1 && scrollX < maxScrollX - 10;

  const snapOffsets = useMemo(
    () => cards.map((_, index) => index * cardWithGap),
    [cards, cardWithGap],
  );

  return (
    <View className="relative min-h-36">
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: paddingHorizontal,
          gap: gap,
        }}
        style={
          Platform.OS === 'web'
            ? ({
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
                scrollPaddingLeft: paddingHorizontal,
              } as any)
            : undefined
        }
        onScroll={e => {
          setScrollX(e.nativeEvent.contentOffset.x);
        }}
        scrollEventThrottle={16}
      >
        {cards.map((card, index) => (
          <View
            key={index}
            style={[
              { width: cardWidth, height: 160 },
              Platform.OS === 'web'
                ? ({ scrollSnapAlign: 'start', scrollSnapStop: 'always' } as any)
                : undefined,
            ]}
          >
            {card}
          </View>
        ))}
      </ScrollView>
      {showLeftBlur && (
        <LinearGradient
          colors={['rgba(28,28,28,0.8)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 40,
            pointerEvents: 'none',
          }}
        />
      )}
      {showRightBlur && (
        <LinearGradient
          colors={['transparent', 'rgba(28,28,28,0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 40,
            pointerEvents: 'none',
          }}
        />
      )}
    </View>
  );
}
