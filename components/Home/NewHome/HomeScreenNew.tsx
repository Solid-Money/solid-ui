import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Address } from 'viem';

import CardDetailsPane from '@/components/Card/NewCardDetails/CardDetailsPane';
import { HERO_EXIT, HeroExit } from '@/components/Card/NewCardDetails/heroMotion';
import HomePromoBanners from '@/components/Home/NewHome/HomePromoBanners';
import HomePromptCard from '@/components/Home/NewHome/HomePromptCard';
import HomeWalletCard from '@/components/Home/NewHome/HomeWalletCard';
import { getSpendableTotal } from '@/components/Home/NewHome/OtherBalancesDropdown';
import OtherBalancesDropdown from '@/components/Home/NewHome/OtherBalancesDropdown/OtherBalancesDropdown';
import WalletActions from '@/components/Home/NewHome/WalletActions';
import WalletBalanceHeadline from '@/components/Home/NewHome/WalletBalanceHeadline';
import PageLayout from '@/components/PageLayout';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { WalletInfo } from '@/components/Wallet';
import LazyWalletTabs from '@/components/Wallet/LazyWalletTabs';
import TokenListSkeleton from '@/components/Wallet/WalletTokenTab/TokenListSkeleton';
import { CARD_INFO_SCREEN } from '@/constants/path';
import { useUserTransactions } from '@/hooks/useAnalytics';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useHomePrompt } from '@/hooks/useHomePrompt';
import { MONITORED_COMPONENTS, useRenderMonitor } from '@/hooks/useRenderMonitor';
import { useTotalSavingsUSD } from '@/hooks/useTotalSavingsUSD';
import useUser from '@/hooks/useUser';
import { useVaultBalance } from '@/hooks/useVault';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { useIntercom } from '@/lib/intercom';
import { formatBalanceUSD, hasCard } from '@/lib/utils';
import { useCardPaneStore } from '@/store/useCardPaneStore';
import { useUserStore } from '@/store/useUserStore';

/**
 * Redesigned home/wallet screen (Apple "glass" style), shown only on qa/preview
 * builds via the dispatcher in index(.native).tsx. Production and all
 * desktop-web users keep LegacyHome.
 *
 * Big "Wallet Balance" number = Wallet + Card (combined for display only — the
 * breakdown sheet lists Wallet, Card and Savings separately and notes that funds
 * must be moved onto the card to spend). Savings sits behind the pill, so
 * headline + pill covers everything. The green card is merged in here; Activity
 * moved to the header bell.
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

  const userHasCard = hasCard(cardStatus);

  // `/?screen=card-info` opens the card pane — the addressable form of the card
  // details "page", now that `/card/details` is only a redirect onto this. The
  // param is cleared straight away for the same reason the rewards screen clears
  // `referral`: it is a one-shot instruction, and leaving it in the URL would
  // re-open the pane every time this screen remounts, including right after the
  // user closed it.
  const { screen: screenParam } = useLocalSearchParams<{ screen?: string }>();
  const openCardPane = useCardPaneStore(state => state.open);

  useEffect(() => {
    if (screenParam !== CARD_INFO_SCREEN) return;
    // No origin rect: there was no card tap to fly back to, so dismissing just
    // closes (see `CardDetailsPane.close`).
    openCardPane();
    router.setParams({ screen: undefined });
  }, [screenParam, openCardPane]);

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
  // Headline = Wallet + Card. They're only combined for display; the breakdown
  // sheet lists them separately and explains that funds must be moved onto the
  // card to be spent. Savings stays out of it (it's the pill), so
  // headline + pill = everything the user holds.
  const spendableBalance = getSpendableTotal({ walletBalance, cardBalance, userHasCard });
  const walletTitle = isBalanceSectionLoading ? null : formatBalanceUSD(spendableBalance);
  const showAssets = isLoadingTokens || hasTokens || !!tokenError;
  // Which next-step prompt (verify / fund / Apple Pay) belongs under the card,
  // if any — null once the user is done or has snoozed the current one.
  const promptKey = useHomePrompt({ hasCard: userHasCard, depositCompleted });

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
              <Skeleton className="h-[35px] w-32 rounded-full" />
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
              <WalletBalanceHeadline balance={walletBalance} />
            </HeroExit>
            <HeroExit spec={HERO_EXIT.balance}>
              <View style={{ transform: [{ translateY: -10 }] }}>
                <OtherBalancesDropdown
                  cardBalance={cardBalance}
                  savingsBalance={savingsBalance}
                  userHasCard={userHasCard}
                  walletBalance={walletBalance}
                />
              </View>
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
          />
          {!isCardStatusLoading && !isDepositStatusUnresolved && promptKey && (
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
      </View>
    </PageLayout>
  );
}
