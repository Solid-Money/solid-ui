import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Address } from 'viem';

import { BalancePillRow } from '@/components/BalanceHeadline';
import CardDetailsPane from '@/components/Card/NewCardDetails/CardDetailsPane';
import { HERO_EXIT, HeroExit } from '@/components/Card/NewCardDetails/heroMotion';
import HomePromoBanners from '@/components/Home/NewHome/HomePromoBanners';
import HomePromptCard from '@/components/Home/NewHome/HomePromptCard';
import HomeRecentActivity from '@/components/Home/NewHome/HomeRecentActivity';
import HomeWalletCard from '@/components/Home/NewHome/HomeWalletCard';
import { getTotalBalance } from '@/components/Home/NewHome/OtherBalancesDropdown';
import OtherBalancesDropdown from '@/components/Home/NewHome/OtherBalancesDropdown/OtherBalancesDropdown';
import WalletActions from '@/components/Home/NewHome/WalletActions';
import WalletBalanceHeadline from '@/components/Home/NewHome/WalletBalanceHeadline';
import PageLayout from '@/components/PageLayout';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { WalletInfo } from '@/components/Wallet';
import LazyWalletTabs from '@/components/Wallet/LazyWalletTabs';
import TokenListSkeleton from '@/components/Wallet/WalletTokenTab/TokenListSkeleton';
import { resolveDigitalWallet } from '@/constants/digital-wallet';
import { CARD_INFO_SCREEN, CARD_INFO_WALLET_PARAM } from '@/constants/path';
import { useUserTransactions } from '@/hooks/useAnalytics';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useHomePrompt } from '@/hooks/useHomePrompt';
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { useIntercom } from '@/lib/intercom';
import { formatBalanceUSD, hasCard } from '@/lib/utils';
import { cardHoldsBalance } from '@/lib/utils/cardHelpers';
import { useCardPaneStore } from '@/store/useCardPaneStore';
import { useUserStore } from '@/store/useUserStore';

/**
 * Redesigned home/wallet screen (Apple "glass" style), shown only on qa/preview
 * builds via the dispatcher in index(.native).tsx. Production and all
 * desktop-web users keep LegacyHome.
 *
 * Big "Balance" number = everything the user holds, Wallet + Card + Savings,
 * combined for display only; the pill below it opens the breakdown that keeps them
 * apart. A card with no balance of its own (Wirex) is left out of the sum and
 * shows up in the breakdown as "Spendable" instead — its balance is a slice of
 * savings, so adding it would count the same money twice. The green card is merged
 * in here; Activity is reached from "Recent activity → See all" at the bottom of
 * this screen, and the header's right-hand button opens support.
 */
export default function HomeScreenNew() {
  useRenderMonitor({ componentName: MONITORED_COMPONENTS.HOME_SCREEN });

  const { user } = useUser();
  const queryClient = useQueryClient();
  const {
    data: balance,
    isLoading: isBalanceLoading,
    isError: isBalanceError,
  } = useVaultBalance(user?.safeAddress as Address);
  const updateUser = useUserStore(state => state.updateUser);
  const intercom = useIntercom();
  const { data: cardStatus, isLoading: isCardStatusLoading } = useCardStatus();
  const { data: cardDetails, isLoading: isCardDetailsLoading } = useCardDetails();
  const { provider: cardProvider } = useCardProvider();

  const userHasCard = hasCard(cardStatus);
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
  const openCardPaneWalletGuide = useCardPaneStore(state => state.openWalletGuide);

  useEffect(() => {
    if (screenParam !== CARD_INFO_SCREEN) return;
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
  }, [screenParam, walletParam, openCardPane, openCardPaneWalletGuide]);

  const {
    isLoading: isLoadingTokens,
    hasTokens,
    totalUSDExcludingVaultTokens,
    error: tokenError,
    retry: retryTokens,
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
      if (!isFresh) {
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
    totalSavingsUSD === undefined;
  const walletBalance = totalUSDExcludingVaultTokens;
  const savingsBalance = totalSavingsUSD ?? 0;
  // Headline = everything the user holds. Combined for display only; the breakdown
  // sheet keeps Wallet, Card / Spendable and Savings apart. The mobile header title
  // is the same figure, so scrolling the headline away doesn't change the number.
  const totalBalance = getTotalBalance({
    walletBalance,
    cardBalance,
    savingsBalance,
    userHasCard,
    cardHoldsOwnBalance,
  });
  const walletTitle = isBalanceSectionLoading ? null : formatBalanceUSD(totalBalance);
  const showAssets = isLoadingTokens || hasTokens || !!tokenError;
  // Which rung of the card funnel belongs under the card, if any — null once the
  // user is done or has snoozed the current one. See `resolveHomePromptStep`.
  const promptKey = useHomePrompt({ hasCard: userHasCard, depositCompleted });
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
      additionalContent={<CardDetailsPane />}
    >
      <View className="mb-5 w-full gap-5 pb-24">
        {isBalanceSectionLoading ? (
          // Mirror the loaded wrappers and their heights so the wallet card does
          // not jump when the headline, breakdown pill and actions replace these.
          <View className="gap-5">
            <View className="items-center gap-1 pt-2">
              <Skeleton className="h-6 w-28 rounded-md" />
              <Skeleton className="h-[54px] w-48 rounded-xl" />
            </View>
            <View className="items-center" style={{ transform: [{ translateY: -10 }] }}>
              <Skeleton className="h-[35px] w-36 rounded-full" />
            </View>
            <View className="flex-row items-center gap-3 px-4">
              <Skeleton className="h-14 flex-1 rounded-full" />
              <Skeleton className="h-14 flex-1 rounded-full" />
              <Skeleton className="h-14 flex-1 rounded-full" />
            </View>
          </View>
        ) : (
          <View className="gap-5">
            <HeroExit spec={HERO_EXIT.balance}>
              <WalletBalanceHeadline balance={totalBalance} />
            </HeroExit>
            <HeroExit spec={HERO_EXIT.balance}>
              <BalancePillRow>
                <OtherBalancesDropdown
                  cardBalance={cardBalance}
                  savingsBalance={savingsBalance}
                  userHasCard={userHasCard}
                  walletBalance={walletBalance}
                />
              </BalancePillRow>
            </HeroExit>
            <HeroExit spec={HERO_EXIT.actions}>
              <WalletActions hasFunds={depositCompleted} hasCard={userHasCard} />
            </HeroExit>
          </View>
        )}

        {/* HomeWalletCard brings its own px-4 and bleeds back out by the shadow the
            PNG bakes into each side, so the visible card lines up with the sections
            below rather than sitting inset. */}
        <View className="gap-5">
          <HomeWalletCard
            hasCard={userHasCard}
            last4={cardDetails?.card_details?.last_4}
            depositCompleted={depositCompleted}
            hasCtaBanner={isPromptReady}
          />
          {isPromptReady && promptKey && (
            <HeroExit spec={HERO_EXIT.belowCard}>
              <HomePromptCard
                promptKey={promptKey}
                depositCompleted={depositCompleted}
                className="px-4"
              />
            </HeroExit>
          )}
          {/* Renders nothing at all when no banner is targeted at this build and
              the hardcoded cashback promo is still paused, so the slot leaves no
              gap behind. */}
          <HomePromoBanners />
        </View>

        {showAssets && (
          <HeroExit spec={HERO_EXIT.belowCard}>
            <View className="mt-5 gap-3 px-4">
              <Text className="text-base font-normal text-white/50">Balances</Text>
              {tokenError ? (
                <View className="flex-1 items-center justify-center p-4">
                  <WalletInfo text="Failed to load tokens" />
                  <Text className="mt-2 text-sm text-muted-foreground">{tokenError}</Text>
                  <TouchableOpacity
                    onPress={retryTokens}
                    className="mt-4 rounded-lg bg-primary px-4 py-2"
                  >
                    <Text className="text-primary-foreground">Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : isLoadingTokens ? (
                <TokenListSkeleton />
              ) : (
                <LazyWalletTabs />
              )}
            </View>
          </HeroExit>
        )}

        <HeroExit spec={HERO_EXIT.belowCard}>
          <HomeRecentActivity />
        </HeroExit>
      </View>
    </PageLayout>
  );
}
