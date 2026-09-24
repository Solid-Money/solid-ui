import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import BuyStockModal from '@/components/Stocks/BuyStockModal';
import SellStockModal from '@/components/Stocks/SellStockModal';
import { Holding, STOCKS } from '@/components/Stocks/stocksData';
import StocksDiscoverSection from '@/components/Stocks/StocksDiscoverSection';
import StocksEmptyHoldings from '@/components/Stocks/StocksEmptyHoldings';
import StocksHoldingsList from '@/components/Stocks/StocksHoldingsList';
import StocksPendingStrip from '@/components/Stocks/StocksPendingStrip';
import StocksPortfolioCard from '@/components/Stocks/StocksPortfolioCard';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { XSTOCKS_TOKENS } from '@/constants/xstocksTokens';
import { useDimension } from '@/hooks/useDimension';
import { useXStockHoldings } from '@/hooks/useXStockHoldings';
import { useXStockPrices } from '@/hooks/useXStockPrices';
import { XStockToken } from '@/hooks/useXStocksTokens';
import { isProduction } from '@/lib/config';

// Stocks is an in-development feature: not accessible in production builds.
// Guards the deep-link/direct-navigation path (the tab/nav entries are gated too).
export default function StocksPage() {
  if (isProduction) {
    return <Redirect href={path.HOME} />;
  }

  return <StocksPageContent />;
}

function StocksPageContent() {
  const { isScreenMedium } = useDimension();
  const scrollRef = useRef<ScrollView>(null);

  const { holdings, isLoading: isHoldingsLoading } = useXStockHoldings();
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
  // Which stock the buy flow should open on. Null means "let the user pick".
  const [buyToken, setBuyToken] = useState<XStockToken | null>(null);
  // True when the buy flow was opened by a deep link rather than by browsing
  // this screen — leaving it should return the user where they came from
  // instead of stranding them on a Stocks tab they never chose to open.
  const [cameFromDeepLink, setCameFromDeepLink] = useState(false);

  // Open a trade straight from a `/stocks?ticker=TSLAx&action=sell` deep link
  // (the Earn page uses it), then clear the params so closing the modal doesn't
  // leave a link that reopens it on the next visit.
  const { ticker: tickerParam, action: actionParam } = useLocalSearchParams<{
    ticker?: string;
    action?: string;
  }>();

  useEffect(() => {
    if (!tickerParam) return;

    const clearParams = () => router.setParams({ ticker: undefined, action: undefined });

    if (actionParam === 'sell') {
      const holding = holdings.find(h => h.ticker === tickerParam);

      // Holdings are read from chain and arrive after this screen mounts, so
      // the params are held until they land rather than dropped on the floor.
      if (!holding) {
        if (!isHoldingsLoading) clearParams();
        return;
      }

      setSelectedHolding(holding);
      setSellModalOpen(true);
      setCameFromDeepLink(true);
      clearParams();
      return;
    }

    const token = XSTOCKS_TOKENS.find(t => t.symbol === tickerParam);
    if (token) {
      setBuyToken(token);
      setBuyModalOpen(true);
      setCameFromDeepLink(true);
    }
    clearParams();
  }, [tickerParam, actionParam, holdings, isHoldingsLoading]);

  function handleBuyPress() {
    setBuyToken(null);
    setCameFromDeepLink(false);
    setBuyModalOpen(true);
  }

  function handleSellPress() {
    if (holdings.length > 0) {
      setSelectedHolding(holdings[0]);
      setCameFromDeepLink(false);
      setSellModalOpen(true);
    }
  }

  function handleStockPress(token: XStockToken) {
    setBuyToken(token);
    setCameFromDeepLink(false);
    setBuyModalOpen(true);
  }

  // Leaving a deep-linked buy flow returns to the screen that opened it (the
  // Earn catalog); leaving one started here just closes the modal.
  function handleBuyClose() {
    setBuyModalOpen(false);
    if (cameFromDeepLink && router.canGoBack()) {
      setCameFromDeepLink(false);
      router.back();
    }
  }

  function handleHoldingPress(holding: Holding) {
    setSelectedHolding(holding);
    setCameFromDeepLink(false);
    setSellModalOpen(true);
  }

  // Same as the buy flow: a deep-linked sale returns to the screen that opened
  // it rather than stranding the user on a Stocks tab they never chose.
  function handleSellClose() {
    setSellModalOpen(false);
    if (cameFromDeepLink && router.canGoBack()) {
      setCameFromDeepLink(false);
      router.back();
    }
  }

  function scrollToDiscover() {
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  const selectedStockPrice = selectedHolding
    ? (holdingPrices[selectedHolding.ticker] ??
      STOCKS.find(s => s.ticker === selectedHolding.ticker)?.price ??
      194.23)
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
        buyToken={buyToken}
        sellModalOpen={sellModalOpen}
        selectedHolding={selectedHolding}
        selectedStockPrice={selectedStockPrice}
        onBuyClose={handleBuyClose}
        onSellClose={handleSellClose}
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
      {/* Keyed on the stock so picking a different one re-seeds the flow's
          initial step instead of reusing the previous selection. */}
      <BuyStockModal
        key={buyToken?.symbol ?? 'picker'}
        isOpen={buyModalOpen}
        initialToken={buyToken}
        onClose={handleBuyClose}
        onExit={handleBuyClose}
        trigger={null}
      />

      <SellStockModal
        holding={selectedHolding}
        stockPrice={selectedStockPrice}
        isOpen={sellModalOpen}
        onClose={handleSellClose}
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
  buyToken: XStockToken | null;
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
  buyToken,
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

      <BuyStockModal
        key={buyToken?.symbol ?? 'picker'}
        isOpen={buyModalOpen}
        initialToken={buyToken}
        onClose={onBuyClose}
        onExit={onBuyClose}
        trigger={null}
      />

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
