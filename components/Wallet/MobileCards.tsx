import { Card, SavingCard, WalletCard } from '@/components/Wallet';
import { USDC_TOKEN_BALANCE } from '@/constants/tokens';
import { TokenBalance } from '@/lib/types';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

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

  const cards = [
    <WalletCard
      key="wallet"
      balance={totalUSDExcludingSoUSD}
      className="w-full h-full"
      tokens={topThreeTokens}
      isLoading={isLoadingTokens}
      decimalPlaces={2}
    />,
    ...(userHasCard
      ? [
          <Card
            key="card"
            balance={cardBalance}
            className="w-full h-full"
            tokens={[USDC_TOKEN_BALANCE]}
            isLoading={isLoadingTokens}
            decimalPlaces={2}
          />,
        ]
      : []),
    <SavingCard key="saving" className="w-full h-full" decimalPlaces={2} />,
  ];

  const totalCards = cards.length;
  const paddingHorizontal = 16;
  const maxScrollX = Math.max(0, (totalCards - 1) * cardWithGap);
  const showLeftBlur = scrollX > 10;
  const showRightBlur = totalCards > 1 && scrollX < maxScrollX - 10;

  return (
    <View className="relative min-h-36">
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWithGap}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: paddingHorizontal,
          gap: gap,
        }}
        onScroll={e => {
          setScrollX(e.nativeEvent.contentOffset.x);
        }}
        scrollEventThrottle={16}
      >
        {cards.map((card, index) => (
          <View key={index} style={{ width: cardWidth }}>
            {card}
          </View>
        ))}
      </ScrollView>
      {showLeftBlur && (
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'transparent']}
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
          colors={['transparent', 'rgba(0,0,0,0.8)']}
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
