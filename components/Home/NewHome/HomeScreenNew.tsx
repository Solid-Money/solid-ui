import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Address } from 'viem';

import { BALANCE_VALUE_STYLE, BalanceAmount } from '@/components/BalanceHeadline';
import CardDetailsPane from '@/components/Card/NewCardDetails/CardDetailsPane';
import { HERO_EXIT, HeroExit } from '@/components/Card/NewCardDetails/heroMotion';
import SpendModeModals from '@/components/Card/NewCardDetails/SpendMode/SpendModeModals';
import { useSpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';
import RainClosingHomeBanner from '@/components/Card/RainSunset/RainClosingHomeBanner';
import { RainClosingSheet } from '@/components/Card/RainSunset/RainClosingSheet';
import EuroLaunchPopup from '@/components/Home/NewHome/EuroLaunchPopup';
import HomeAssetsCard, { buildHomeAssets } from '@/components/Home/NewHome/HomeAssetsCard';
import HomeBalancePills from '@/components/Home/NewHome/HomeBalancePills';
import HomeIncidentNotice, {
  IncidentNoticeSheet,
} from '@/components/Home/NewHome/HomeIncidentNotice';
import HomePromoBanners from '@/components/Home/NewHome/HomePromoBanners';
import HomePromptCard from '@/components/Home/NewHome/HomePromptCard';
import HomeRecentActivity from '@/components/Home/NewHome/HomeRecentActivity';
import HomeSpendCashbackTiles from '@/components/Home/NewHome/HomeSpendCashbackTiles';
import HomeWalletCard from '@/components/Home/NewHome/HomeWalletCard';
import { holdsFundsAnywhere } from '@/components/Home/NewHome/OtherBalancesDropdown';
import WalletActions from '@/components/Home/NewHome/WalletActions';
import PageLayout from '@/components/PageLayout';
import TierTrialSlot from '@/components/Rewards/NewRewards/TierTrialSlot';
import {
  TAB_SUMMARY_LABEL,
  TabSummary,
  TabSummaryActionSkeleton,
  TabSummaryHeadline,
} from '@/components/TabSummary';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { resolveDigitalWallet } from '@/constants/digital-wallet';
import { CARD_INFO_SCREEN, CARD_INFO_WALLET_PARAM, path } from '@/constants/path';
import { useActivityRefresh } from '@/hooks/useActivityRefresh';
import { useUserTransactions } from '@/hooks/useAnalytics';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useHomeLinkAction } from '@/hooks/useHomeLinkAction';
import { useHomeLoadTracking } from '@/hooks/useHomeLoadTracking';
import { useHomePrompt } from '@/hooks/useHomePrompt';
import { useCardDisplayCurrency } from '@/hooks/useMainCurrency';
import { usePortfolio } from '@/hooks/usePortfolio';
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { readHomeSnapshot, saveHomeSnapshot } from '@/lib/homeSnapshot';
import { useIntercom } from '@/lib/intercom';
import { markStartup, reportHomeContentReady } from '@/lib/startupTiming';
import { CardProvider } from '@/lib/types';
import { formatBalance, hasCard } from '@/lib/utils';
import { cardHoldsBalance } from '@/lib/utils/cardHelpers';
import { useCardPaneStore } from '@/store/useCardPaneStore';
import { useUserStore } from '@/store/useUserStore';
import { useWhatsNewStore } from '@/store/useWhatsNewStore';

/**
 * A card link waiting on a card status read that failed reads it again after
 * this, doubling each time, up to the max.
 */
const CARD_STATUS_RETRY_MS = 2_000;
const CARD_STATUS_RETRY_MAX_MS = 30_000;

/**
 * Redesigned home/wallet screen (Apple "glass" style), shown only on qa/preview
 * builds via the dispatcher in index(.native).tsx. Production and all
 * desktop-web users keep LegacyHome.
 *
 * Big "Balance" number = everything the user holds, Wallet + Card + Savings,
 * combined for display only; the Assets section below the card shows the breakdown.
 * A card with no balance of its own (Wirex) is left out of the sum — its balance
 * is a slice of savings, so adding it would count the same money twice. The green card is merged
 * in here; Activity is reached from "Recent activity → See all" at the bottom of
 * this screen, and the header's right-hand button opens support.
 */
export default function HomeScreenNew() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.HOME_SCREEN });

  const { user } = useUser();
  const portfolio = usePortfolio();
  const queryClient = useQueryClient();
  const { refetchAll, isRefreshing } = useActivityRefresh();
  const {
    data: balance,
    isLoading: isBalanceLoading,
    isError: isBalanceError,
  } = useVaultBalance(user?.safeAddress as Address);
  const updateUser = useUserStore(state => state.updateUser);
  const setHomeReady = useWhatsNewStore(state => state.setHomeReady);
  const intercom = useIntercom();
  const {
    data: cardStatus,
    isLoading: isCardStatusLoading,
    isError: isCardStatusError,
    errorUpdatedAt: cardStatusErrorAt,
    refetch: refetchCardStatus,
  } = useCardStatus();
  const { data: cardDetails, isLoading: isCardDetailsLoading } = useCardDetails();
  const { provider: cardProvider } = useCardProvider();
  const { symbol: displaySymbol, toDisplayAmount } = useCardDisplayCurrency();

  const userHasCard = hasCard(cardStatus);
  const showWirexTiles = userHasCard && cardProvider === CardProvider.WIREX;
  // Wirex mode and availability use the same figures as the card's mode picker.
  const spendModeFigures = useSpendModeFigures();
  const homeSpendMode =
    !showWirexTiles && userHasCard && spendModeFigures.canChangeMode ? spendModeFigures.mode : null;
  // Whether the card balance is a pot of its own or a view onto savings (Wirex).
  const cardHoldsOwnBalance = cardHoldsBalance(cardProvider);

  // `/?screen=card-info` opens the card pane — the addressable form of the card
  // details "page", now that `/card/details` is only a redirect onto this. The
  // param is cleared straight away for the same reason the rewards screen clears
  // `referral`: it is a one-shot instruction, and leaving it in the URL would
  // re-open the pane every time this screen remounts, including right after the
  // user closed it.
  const { screen: screenParam, wallet: walletParam } = useLocalSearchParams<{
    screen?: string;
    wallet?: string;
  }>();
  const openCardPane = useCardPaneStore(state => state.open);
  const isCardPaneOpen = useCardPaneStore(state => state.isOpen);
  const openCardPaneWalletGuide = useCardPaneStore(state => state.openWalletGuide);

  // Rain sunset: a card the sunset closed has no details to show — the pane
  // would draw it as if it still worked. Its own screen says why instead.
  const cardClosedBySunset = Boolean(cardStatus?.rainSunset?.cardClosed);

  // Whether the card is one the sunset closed is known only once its status
  // is in. Until then (still loading, or the read failed with nothing cached)
  // a card link waits rather than guess the card works. With no user there is
  // no status query at all: neither loading nor failed, so links act at once.
  const cardStatusUnknown = isCardStatusLoading || (isCardStatusError && cardStatus === undefined);

  // A failed read is tried again while a card link waits on it, each time a
  // little later (the query itself does not retry).
  const cardStatusRetries = useRef(0);
  useEffect(() => {
    if (screenParam !== CARD_INFO_SCREEN || !isCardStatusError || cardStatus !== undefined) {
      cardStatusRetries.current = 0;
      return;
    }
    const delay = Math.min(
      CARD_STATUS_RETRY_MS * 2 ** cardStatusRetries.current,
      CARD_STATUS_RETRY_MAX_MS,
    );
    const timer = setTimeout(() => {
      cardStatusRetries.current += 1;
      void refetchCardStatus();
    }, delay);
    return () => clearTimeout(timer);
  }, [screenParam, isCardStatusError, cardStatus, cardStatusErrorAt, refetchCardStatus]);

  useEffect(() => {
    if (screenParam !== CARD_INFO_SCREEN) return;
    // Keep the link until the card's status is in (see above).
    if (cardStatusUnknown) return;
    if (cardClosedBySunset) {
      router.setParams({ screen: undefined, [CARD_INFO_WALLET_PARAM]: undefined });
      router.push(path.CARD_CLOSED);
      return;
    }
    // `&wallet=apple|google` asks for the "Add to Wallet" guide on top of the
    // pane, on that wallet's tab — the addressable form of the popup, which is
    // what lets the home "Add to Apple Pay" banner be nothing but a redirect.
    const wallet = resolveDigitalWallet(walletParam);
    // No origin rect either way: there was no card tap to fly back to, so
    // dismissing just closes (see `CardDetailsPane.close`).
    if (wallet) {
      openCardPaneWalletGuide(wallet);
    } else {
      openCardPane();
    }
    router.setParams({ screen: undefined, [CARD_INFO_WALLET_PARAM]: undefined });
  }, [
    screenParam,
    walletParam,
    openCardPane,
    openCardPaneWalletGuide,
    cardClosedBySunset,
    cardStatusUnknown,
  ]);

  // `?whatsNew=`, `?deposit=` and `?spendMode=` open what a push or link was
  // about over this screen (`constants/homeLinkParams`).
  useHomeLinkAction({
    isCardKnown: !isCardStatusLoading,
    hasCard: userHasCard,
    isSpendModeKnown: !spendModeFigures.isLoading,
    canChangeMode: spendModeFigures.canChangeMode,
  });

  const {
    isLoading: isLoadingTokens,
    hasTokens,
    totalUSDExcludingVaultTokens,
    error: tokenError,
    refresh: refreshTokens,
  } = useWalletTokens();

  // IMPORTANT: Guard to prevent infinite re-render loop (mirrors LegacyHome).
  // Only refresh tokens ONCE when balance first loads. DO NOT REMOVE — this
  // guard fixed the Sentry "Excessive renders in HomeScreen" bug.
  const hasTriggeredInitialRefresh = useRef(false);

  useEffect(() => {
    if (balance && !isBalanceLoading && !hasTriggeredInitialRefresh.current) {
      hasTriggeredInitialRefresh.current = true;
      // Avoid running the heavy multi-chain balance fetch twice at launch: the
      // protected layout already prefetched token balances, so only force a
      // refresh when that cached data is missing or stale.
      const state = queryClient.getQueryState(['tokenBalances', user?.safeAddress]);
      const isFresh = !!state?.data && Date.now() - state.dataUpdatedAt < 15_000;
      // A fetch already under way is the refresh. Forcing another would cancel it
      // and start the whole fan-out again: with a restored cache the balance is
      // here on the first render, while the mount fetch has only just started.
      if (!isFresh && state?.fetchStatus !== 'fetching') {
        refreshTokens();
      }
    }
  }, [balance, isBalanceLoading, refreshTokens, queryClient, user?.safeAddress]);

  // Reset when user changes (e.g., account switch) to allow fresh token sync.
  useEffect(() => {
    hasTriggeredInitialRefresh.current = false;
  }, [user?.safeAddress]);

  const {
    data: userDepositTransactions,
    isLoading: isDepositsLoading,
    isError: isDepositsError,
  } = useUserTransactions(user?.safeAddress);
  const { data: totalSavingsUSD, isLoading: isTotalSavingsLoading } = useTotalSavingsUSD();

  const isDeposited = !!userDepositTransactions?.deposits?.length;
  const cardBalance = Number(cardDetails?.balances.available?.amount || '0');
  const depositCompleted = isDeposited || hasTokens || (balance ?? 0) > 0;
  // `false` is not a meaningful answer until every source that can prove the
  // account is funded has settled. Without this tri-state guard, the initial
  // empty query values briefly render the "Fund your wallet" prompt for funded
  // users. Errors stay unresolved too; a failed request must not look like a
  // confirmed zero balance.
  const isDepositStatusUnresolved =
    !depositCompleted &&
    (isDepositsLoading ||
      isLoadingTokens ||
      isBalanceLoading ||
      isDepositsError ||
      !!tokenError ||
      isBalanceError);

  useEffect(() => {
    if (!user) return;
    if (user.isDeposited === isDeposited) return;
    if (isDeposited) {
      updateUser({ ...user, isDeposited });
    }
  }, [isDeposited, user, updateUser]);

  useEffect(() => {
    if (!user || !intercom) return;
    intercom.update({
      userId: user.userId,
      name: user.username,
      email: user.email,
    });
  }, [user, intercom]);

  const isCardBalanceLoading = isCardStatusLoading || (userHasCard && isCardDetailsLoading);
  const isBalanceSectionLoading =
    isLoadingTokens ||
    isBalanceLoading ||
    isTotalSavingsLoading ||
    isCardBalanceLoading ||
    portfolio.isLoading;
  // While the live figures load, the ones this screen showed last time (lib/homeSnapshot),
  // marked as updating, instead of skeletons. Null when there are none for this user.
  const lastKnown = useMemo(
    () => (isBalanceSectionLoading ? readHomeSnapshot(user?.userId) : null),
    [isBalanceSectionLoading, user?.userId],
  );
  const isShowingSkeleton = isBalanceSectionLoading && !lastKnown;

  // Times each part of the loading gate, for launches and returns to the app alike, so a
  // slow load says which part held it up (lib/homeLoadTiming).
  useHomeLoadTracking({
    gates: {
      tokens: isLoadingTokens,
      vaultBalance: isBalanceLoading,
      savings: isTotalSavingsLoading,
      card: isCardBalanceLoading,
      portfolio: portfolio.isLoading,
    },
    lastKnownSavedAt: lastKnown?.savedAt,
  });

  useEffect(() => {
    markStartup('homeMounted');
  }, []);

  useEffect(() => {
    if (isBalanceSectionLoading) {
      setHomeReady(false);
      return;
    }

    // Let the loaded balance and card commit a frame before starting the delay.
    const frame = requestAnimationFrame(() => {
      reportHomeContentReady(queryClient);
      setHomeReady(true);
    });
    return () => {
      cancelAnimationFrame(frame);
      setHomeReady(false);
    };
  }, [isBalanceSectionLoading, setHomeReady, queryClient]);
  const walletBalance = totalUSDExcludingVaultTokens;
  const savingsBalance = totalSavingsUSD ?? 0;
  // Headline = everything the user holds. Combined for display only; the breakdown
  // in the Assets section keeps the holdings apart. The mobile header title
  // is the same figure, so scrolling the headline away doesn't change the number.
  // Balance is what the user holds net of what they've borrowed (Figma v2, credit home):
  // the Assets rows, Borrowed included, add up to it. Gross holdings are "Total assets" on the
  // overview. If debt couldn't be read the figure is flagged incomplete below the headline.
  const totalBalance = portfolio.netBalance;
  // Shown in the main currency, like the card tiles beside it. The card details it reads are
  // already part of the loading gate above, so the figure never flips from dollars to euros.
  const displayTotal = totalBalance === undefined ? undefined : toDisplayAmount(totalBalance);
  // Whether the action row offers Swap and Send at all. Deliberately NOT
  // `depositCompleted` on its own: that only knows about wallet funding, and a
  // cardholder who funds their card directly has none of it — see
  // `holdsFundsAnywhere`.
  const hasFunds = holdsFundsAnywhere({
    depositCompleted,
    walletBalance,
    cardBalance,
    savingsBalance,
    userHasCard,
    cardHoldsOwnBalance,
  });
  const walletTitle = lastKnown
    ? formatBalance(lastKnown.balance.amount, lastKnown.balance.symbol)
    : isBalanceSectionLoading || displayTotal === undefined
      ? null
      : formatBalance(displayTotal, displaySymbol);

  // Remember complete figures for the next launch or return to the app. Never partial ones
  // (still loading, or some balance missing or unpriced): those would be drawn as the
  // user's balance before anything loads. The ref keeps the effect to the fields it reads.
  const portfolioRef = useRef(portfolio);
  portfolioRef.current = portfolio;
  useEffect(() => {
    if (isBalanceSectionLoading || portfolio.isError) return;
    if (!user?.userId || displayTotal === undefined) return;
    saveHomeSnapshot({
      userId: user.userId,
      balance: { amount: displayTotal, symbol: displaySymbol },
      hasFunds,
      hasCard: userHasCard,
      assets: buildHomeAssets(portfolioRef.current).map(asset => asset.snapshot),
    });
  }, [
    isBalanceSectionLoading,
    portfolio.isError,
    user?.userId,
    displayTotal,
    displaySymbol,
    hasFunds,
    userHasCard,
    portfolio.earnAssets,
    portfolio.stableAssets,
    portfolio.cryptoAssets,
    portfolio.eurYield,
    portfolio.lockedTotal,
    portfolio.nextUnlockAt,
    portfolio.pendingWithdrawals,
    portfolio.hasCardBalance,
    portfolio.cardBalance,
  ]);
  // Which rung of the card funnel belongs under the card, if any — null once the
  // user is done or has snoozed the current one. See `resolveHomePromptStep`.
  const { promptKey, declinedPayment } = useHomePrompt({ hasCard: userHasCard, depositCompleted });
  // "Fund your wallet" is the one banner a wrong `depositCompleted` would show
  // to the wrong user, so it is the only one that waits for that answer to
  // settle. The verification banners do not read it at all, and a brand-new user
  // — exactly the audience for "Get your card" — is also the likeliest to have an
  // empty or erroring token fetch, so holding those back would hide the banner
  // from the people it is for.
  const isPromptReady =
    !isCardStatusLoading && !!promptKey && (promptKey !== 'fund' || !isDepositStatusUnresolved);

  return (
    // The card details are a layer on this screen rather than a route of their own,
    // so opening them is a state change on an already-mounted tree — that's what
    // lets the card animate without a screen mounting underneath it. This screen's
    // own content clears out of the way as the card flies (Figma 20048:3312).
    <PageLayout
      mobileTitle={walletTitle}
      animateCardHeroExit
      additionalContent={
        <>
          <CardDetailsPane />
          <SpendModeModals figures={spendModeFigures} />
          <IncidentNoticeSheet />
          {/* Rain sunset: opened from the Home banner and the card notice alike. */}
          <RainClosingSheet />
          <EuroLaunchPopup
            isWirexCardholder={showWirexTiles}
            // Undefined until the card details answer, so the popup never guesses "not on euro".
            mainCurrency={cardDetails ? (cardDetails.main_currency ?? 'USD') : undefined}
          />
        </>
      }
      scrollEnabled={!isCardPaneOpen}
      onRefresh={Platform.OS !== 'web' ? refetchAll : undefined}
      refreshing={isRefreshing}
    >
      <View className="mb-5 w-full gap-5 pb-24">
        {/* A known incident (an outage, a delay) the team has posted. Renders
            nothing when there is none, which is nearly always. */}
        <HomeIncidentNotice className="px-4" />
        {/* Rain sunset: the card-closing banner, in the same slot (Figma "1 · Home ·
            Card closing banner"). Nothing for anyone it does not affect. */}
        <RainClosingHomeBanner className="px-4" />
        <TabSummary
          headline={
            <HeroExit spec={HERO_EXIT.balance}>
              <TabSummaryHeadline
                label={
                  isShowingSkeleton ? (
                    <Skeleton className="h-6 w-28 rounded-md" />
                  ) : (
                    <Text className={TAB_SUMMARY_LABEL}>Balance</Text>
                  )
                }
                value={
                  lastKnown ? (
                    <BalanceAmount
                      balance={lastKnown.balance.amount}
                      symbol={lastKnown.balance.symbol}
                    />
                  ) : isBalanceSectionLoading ? (
                    <Skeleton className="h-[54px] w-48 rounded-xl" />
                  ) : displayTotal === undefined ? (
                    <Text className="font-semibold" style={BALANCE_VALUE_STYLE}>
                      —
                    </Text>
                  ) : (
                    <BalanceAmount balance={displayTotal} symbol={displaySymbol} />
                  )
                }
                badge={
                  lastKnown ? (
                    <Text
                      className="text-sm text-white/50"
                      accessibilityLabel="Balances updating"
                      accessibilityState={{ busy: true }}
                    >
                      Updating…
                    </Text>
                  ) : isBalanceSectionLoading ? null : displayTotal === undefined ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Retry balances"
                      onPress={() => void refetchAll()}
                    >
                      <Text className="text-sm text-brand">Balances unavailable · Retry</Text>
                    </TouchableOpacity>
                  ) : (
                    <HomeBalancePills
                      dailyYield={
                        portfolio.dailyYield === undefined
                          ? undefined
                          : toDisplayAmount(portfolio.dailyYield)
                      }
                      yieldSymbol={displaySymbol}
                      canHaveCardCredit={showWirexTiles}
                    />
                  )
                }
              />
            </HeroExit>
          }
          actions={
            <HeroExit spec={HERO_EXIT.actions}>
              {lastKnown ? (
                <WalletActions hasFunds={lastKnown.hasFunds} hasCard={lastKnown.hasCard} />
              ) : isBalanceSectionLoading ? (
                <TabSummaryActionSkeleton count={3} />
              ) : (
                <WalletActions hasFunds={hasFunds} hasCard={userHasCard} />
              )}
              {!isBalanceSectionLoading && displayTotal !== undefined && portfolio.isError && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Retry balances"
                  onPress={() => void refetchAll()}
                  className="items-center px-4 pt-2"
                >
                  <Text className="text-[13px] text-white/50">
                    Some balances unavailable · <Text className="text-[#94F27F]">Retry</Text>
                  </Text>
                </TouchableOpacity>
              )}
            </HeroExit>
          }
        />

        {/* HomeWalletCard brings its own px-4 and bleeds back out by the shadow the
            PNG bakes into each side, so the visible card lines up with the sections
            below rather than sitting inset. */}
        <View className="gap-5">
          {!isBalanceSectionLoading && (
            <HomeWalletCard
              hasCard={userHasCard}
              last4={cardDetails?.card_details?.last_4}
              depositCompleted={depositCompleted}
              hasCtaBanner={isPromptReady}
              spendMode={homeSpendMode}
            />
          )}
          {showWirexTiles && !isBalanceSectionLoading && (
            <HeroExit spec={HERO_EXIT.belowCard}>
              <HomeSpendCashbackTiles figures={spendModeFigures} />
            </HeroExit>
          )}
          {isPromptReady && promptKey && !(showWirexTiles && promptKey === 'cashback') && (
            <HeroExit spec={HERO_EXIT.belowCard}>
              <HomePromptCard
                promptKey={promptKey}
                declined={declinedPayment}
                depositCompleted={depositCompleted}
                className="px-4"
              />
            </HeroExit>
          )}
          {/* A tier trial the user has been given or is running. Renders
              nothing when they have neither, which is the common case. */}
          <TierTrialSlot />
          {/* Renders nothing at all when no banner is targeted at this build and
              the hardcoded cashback promo is still paused, so the slot leaves no
              gap behind. */}
          <HomePromoBanners />
        </View>

        <HeroExit spec={HERO_EXIT.belowCard}>
          <HomeAssetsCard portfolio={portfolio} lastKnown={lastKnown?.assets} />
        </HeroExit>

        <HeroExit spec={HERO_EXIT.belowCard}>
          <HomeRecentActivity />
        </HeroExit>
      </View>
    </PageLayout>
  );
}
