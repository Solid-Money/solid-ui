import React, { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import PageLayout from '@/components/PageLayout';
import BuyStockModal from '@/components/Stocks/BuyStockModal';
import SellStockModal from '@/components/Stocks/SellStockModal';
import { Holding, STOCKS } from '@/components/Stocks/stocksData';
import StocksDiscoverSection from '@/components/Stocks/StocksDiscoverSection';
import { XStockToken } from '@/hooks/useXStocksTokens';
import StocksEmptyHoldings from '@/components/Stocks/StocksEmptyHoldings';
import StocksHoldingsList from '@/components/Stocks/StocksHoldingsList';
import StocksPendingStrip from '@/components/Stocks/StocksPendingStrip';
import StocksPortfolioCard from '@/components/Stocks/StocksPortfolioCard';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { useXStockHoldings } from '@/hooks/useXStockHoldings';
import { useXStockPrices } from '@/hooks/useXStockPrices';

export default function StocksPage() {
  const { isScreenMedium } = useDimension();
  const scrollRef = useRef<ScrollView>(null);

  const { holdings } = useXStockHoldings();
  const hasHoldings = holdings.length > 0;
  const holdingTickers = holdings.map(h => h.ticker);
  const holdingPrices = useXStockPrices(holdingTickers);
  const totalPortfolioValue = holdings.reduce(
    (sum, h) => sum + h.shares * (holdingPrices[h.ticker] ?? 0),
    0,
  );

  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);

  function handleBuyPress() {
    setBuyModalOpen(true);
  }

  function handleSellPress() {
    if (holdings.length > 0) {
      setSelectedHolding(holdings[0]);
      setSellModalOpen(true);
    }
  }

  function handleStockPress(_token: XStockToken) {
    setBuyModalOpen(true);
  }

  function handleHoldingPress(holding: Holding) {
    setSelectedHolding(holding);
    setSellModalOpen(true);
  }

  function scrollToDiscover() {
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  const selectedStockPrice = selectedHolding
    ? (holdingPrices[selectedHolding.ticker] ?? STOCKS.find(s => s.ticker === selectedHolding.ticker)?.price ?? 194.23)
    : 194.23;

  if (isScreenMedium) {
    return (
      <DesktopLayout
        hasHoldings={hasHoldings}
        holdings={holdings}
        holdingPrices={holdingPrices}
        totalPortfolioValue={totalPortfolioValue}
        onBuyPress={handleBuyPress}
        onSellPress={handleSellPress}
        onStockPress={handleStockPress}
        onHoldingPress={handleHoldingPress}
        buyModalOpen={buyModalOpen}
        sellModalOpen={sellModalOpen}
        selectedHolding={selectedHolding}
        selectedStockPrice={selectedStockPrice}
        onBuyClose={() => setBuyModalOpen(false)}
        onSellClose={() => setSellModalOpen(false)}
      />
    );
  }

  return (
    <PageLayout scrollable={false}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-28"
      >
        {/* Page title */}
        <View className="px-5 pb-2 pt-4">
          <Text className="text-3xl font-semibold text-white">Stocks</Text>
        </View>

        {/* Pending strip (show when there's a pending order) */}
        {hasHoldings && <StocksPendingStrip message="Order pending · AAPLx $50 buy" />}

        {/* Portfolio card */}
        <View className="px-5 pt-3">
          <StocksPortfolioCard
            hasHoldings={hasHoldings}
            totalValue={totalPortfolioValue}
            onBuyPress={handleBuyPress}
            onSellPress={handleSellPress}
          />
        </View>

        {/* Empty state or holdings list */}
        {hasHoldings ? (
          <StocksHoldingsList
            holdings={holdings}
            prices={holdingPrices}
            onHoldingPress={handleHoldingPress}
          />
        ) : (
          <StocksEmptyHoldings onBrowsePress={scrollToDiscover} />
        )}

        {/* Discover section */}
        <StocksDiscoverSection
          compact={hasHoldings}
          onStockPress={handleStockPress}
          onSearchPress={scrollToDiscover}
        />
      </ScrollView>

      {/* Modals (rendered outside scroll) */}
      <BuyStockModal isOpen={buyModalOpen} onClose={() => setBuyModalOpen(false)} trigger={null} />

      <SellStockModal
        holding={selectedHolding}
        stockPrice={selectedStockPrice}
        isOpen={sellModalOpen}
        onClose={() => setSellModalOpen(false)}
        trigger={null}
      />
    </PageLayout>
  );
}

type DesktopLayoutProps = {
  hasHoldings: boolean;
  holdings: Holding[];
  holdingPrices: Record<string, number>;
  totalPortfolioValue: number;
  onBuyPress: () => void;
  onSellPress: () => void;
  onStockPress: (token: XStockToken) => void;
  onHoldingPress: (holding: Holding) => void;
  buyModalOpen: boolean;
  sellModalOpen: boolean;
  selectedHolding: Holding | null;
  selectedStockPrice: number;
  onBuyClose: () => void;
  onSellClose: () => void;
};

function DesktopLayout({
  hasHoldings,
  holdings,
  holdingPrices,
  totalPortfolioValue,
  onBuyPress,
  onSellPress,
  onStockPress,
  onHoldingPress,
  buyModalOpen,
  sellModalOpen,
  selectedHolding,
  selectedStockPrice,
  onBuyClose,
  onSellClose,
}: DesktopLayoutProps) {
  return (
    <PageLayout>
      <View className="mx-auto w-full max-w-7xl gap-8 px-8 py-10">
        <View className="flex-row items-center justify-between">
          <Text className="text-3xl font-semibold text-white">Stocks</Text>
          <Text className="text-sm text-white/50">Tokenized · Self-custodied</Text>
        </View>

        <View className="flex-row items-start gap-8">
          {/* Left column: portfolio + holdings */}
          <View className="max-w-sm flex-1 gap-6">
            <StocksPortfolioCard
              hasHoldings={hasHoldings}
              totalValue={totalPortfolioValue}
              onBuyPress={onBuyPress}
              onSellPress={onSellPress}
            />

            {hasHoldings ? (
              <View className="overflow-hidden rounded-[20px] bg-[#1c1c1c] pb-2">
                <StocksHoldingsList
                  holdings={holdings}
                  prices={holdingPrices}
                  onHoldingPress={onHoldingPress}
                />
              </View>
            ) : (
              <StocksEmptyHoldings onBrowsePress={() => {}} />
            )}
          </View>

          {/* Right column: discover */}
          <View className="flex-1">
            <View className="overflow-hidden rounded-[20px] bg-[#1c1c1c] pb-4">
              <View className="px-5 pb-2 pt-5">
                <Text className="text-lg font-semibold text-white">Discover stocks</Text>
              </View>
              <StocksDiscoverSection compact={false} onStockPress={onStockPress} />
            </View>
          </View>
        </View>
      </View>

      <BuyStockModal isOpen={buyModalOpen} onClose={onBuyClose} trigger={null} />

      <SellStockModal
        holding={selectedHolding}
        stockPrice={selectedStockPrice}
        isOpen={sellModalOpen}
        onClose={onSellClose}
        trigger={null}
      />
    </PageLayout>
  );
}
