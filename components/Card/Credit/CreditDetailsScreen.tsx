import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import { base, fuse } from 'viem/chains';

import { AdditionalCollateral } from '@/components/Card/Credit/AdditionalCollateral';
import CreditSheet, { type CreditSheetRoute } from '@/components/Card/Credit/CreditSheet';
import {
  assetName,
  CREDIT_COLORS,
  CreditSectionHelp,
  formatTokenUnits,
  PillButton,
} from '@/components/Card/Credit/creditUi';
import LoanCard, { SaleNotice } from '@/components/Card/Credit/LoanCard';
import { summarizeLoanSafety } from '@/components/Card/Credit/loanSafety';
import {
  CreditCollateralMark,
  CreditGlyph,
  LoanSafetyBanner,
  loanSafetyCopy,
} from '@/components/Card/Credit/loanSafetyUi';
import { useCreditDetails } from '@/components/Card/Credit/useCreditDetails';
import { explorerTxUrl } from '@/components/Card/Credit/useLoanRepay';
import CollateralHelpSheet from '@/components/Card/NewCardDetails/SpendMode/CollateralHelpSheet';
import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { CREDIT_SOURCE_SPEND_MODE, path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import {
  isSamePendingUnlock,
  showUnlockOutcome,
  UnlockBlockedError,
  useCollateralUnlock,
} from '@/hooks/useCollateralUnlock';
import { SALE_LOOKBACK_SECONDS } from '@/hooks/useLoanSales';
import { track } from '@/lib/analytics';
import { valueOf } from '@/lib/creditRisk';
import { useCardPaneStore } from '@/store/useCardPaneStore';

import type { LoanModel } from '@/lib/creditRisk';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ParamListBase } from '@react-navigation/native';
import type { Address } from 'viem';

/**
 * The Credit overview and its Loan safety screen share the live position data and action sheets.
 *
 * Opened from "View Credit details" on the spend-mode sheet, from the borrow-position card, and
 * from the portfolio. Every figure is read from the chain; the page re-reads every 30 seconds so
 * a countdown or a pending unlock moves while it is open.
 */
const CreditDetailsScreen = ({ showsLoanSafety = false }: { showsLoanSafety?: boolean }) => {
  const navigation = useNavigation();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const isSpendModeOpen = useCardPaneStore(state => state.isSpendModeOpen);
  const details = useCreditDetails();
  const fuseUnlock = useCollateralUnlock(fuse.id);
  const baseUnlock = useCollateralUnlock(base.id);
  const unlocks = { [fuse.id]: fuseUnlock, [base.id]: baseUnlock } as Record<
    number,
    typeof fuseUnlock
  >;
  const [stack, setStack] = useState<CreditSheetRoute[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { loans, format, formatBalance, now } = details;

  // Once per visit, after the first read, so the funnel can be split by what the cardholder saw.
  const worst = details.status;
  const hasTracked = useRef(false);
  useEffect(() => {
    if (showsLoanSafety || hasTracked.current || details.isLoading) return;
    hasTracked.current = true;
    track(TRACKING_EVENTS.CARD_CREDIT_DETAILS_VIEWED, { status: worst, loans: loans.length });
  }, [details.isLoading, loans.length, showsLoanSafety, worst]);

  const open = useCallback((route: CreditSheetRoute) => setStack([route]), []);

  const openRepay = useCallback(() => {
    const owing = details.owingChainIds;
    if (owing.length > 1) open({ view: 'pick-loan' });
    else if (owing.length === 1) open({ view: 'repay', chainId: owing[0] });
  }, [details.owingChainIds, open]);

  const openAsset = useCallback(
    (chainId: number, token: Address) => {
      track(TRACKING_EVENTS.CARD_CREDIT_ASSET_OPENED, { chain_id: chainId });
      open({ view: 'asset', chainId, token });
    },
    [open],
  );

  /** A refusal written for the cardholder is shown as it is; anything else is translated. */
  const cancelUnlock = async (loan: LoanModel) => {
    const done = await unlocks[loan.chainId]
      .cancel(loan.pendingUnlock ?? undefined)
      .catch(error => {
        showUnlockOutcome(error);
        return null;
      });
    if (done)
      Toast.show({
        type: 'success',
        text1: 'Unlock cancelled',
        text2: 'It stays locked in your loan.',
      });
  };

  const finishUnlock = async (loan: LoanModel) => {
    const done = await unlocks[loan.chainId]
      .finish(loan.pendingUnlock ?? undefined)
      .catch(error => {
        // A refusal for want of cover is shown in the card itself, with what to do next.
        if (!(error instanceof UnlockBlockedError && error.reason === 'needs-more-cover')) {
          showUnlockOutcome(error);
        }
        return null;
      });
    if (done) {
      // The amount from the module's own `CollateralWithdrawn`; without it, no figure at all
      // rather than the estimate made before signing.
      const asset = loan.assets.find(
        candidate => candidate.token.toLowerCase() === done.token.toLowerCase(),
      );
      Toast.show({
        type: 'success',
        text1: asset ? `${assetName(asset)} unlocked` : 'Unlocked',
        text2:
          asset && done.amount !== null
            ? `${formatTokenUnits(done.amount, asset.decimals)} ${asset.symbol} (${format(valueOf(done.amount, asset.priceUsd, asset.decimals))}) is back in your wallet.`
            : 'It’s back in your wallet.',
      });
    }
  };

  const unlockAll = async (loan: LoanModel) => {
    const done = await unlocks[loan.chainId]
      .withdrawAll(loan.assets.map(asset => asset.token))
      .catch(error => {
        // A pending outcome is news, not a failure; everything else on the usual error path.
        showUnlockOutcome(error);
        return null;
      });
    if (done)
      Toast.show({
        type: 'success',
        text1: 'Unlocked',
        text2: 'Everything locked is back in your wallet.',
      });
  };

  // Until every chain has answered, a total would leave out a loan still loading.
  const isFirstLoad = details.isLoading;

  const fallbackHref = showsLoanSafety ? path.CARD_CREDIT : path.CARD_DETAILS;
  const returnsToSpendMode =
    !showsLoanSafety && source === CREDIT_SOURCE_SPEND_MODE && isSpendModeOpen;
  const goBack = useCallback(() => {
    if (returnsToSpendMode) {
      // The drawer lives on Home. The Card tab can already have its own stack,
      // so go back at the tab level when Home is the previous tab.
      const tabs = navigation.getParent<BottomTabNavigationProp<ParamListBase>>();
      const state = tabs?.getState();
      const previousKey = state?.history?.at(-2)?.key;
      if (
        tabs &&
        state?.type === 'tab' &&
        state.routes.some(route => route.name === 'index' && route.key === previousKey)
      ) {
        tabs.dispatch({ ...CommonActions.goBack(), target: state.key });
      } else {
        router.navigate(path.HOME);
      }
    } else if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  }, [fallbackHref, navigation, returnsToSpendMode]);

  // Android Back: this screen's own handler, added on focus so it runs before the card pane's
  // (still open underneath) — closing a sheet first, then leaving the page on the first press.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (stack.length) setStack([]);
        else if (isHelpOpen) setIsHelpOpen(false);
        else goBack();
        return true;
      });
      return () => subscription.remove();
    }, [goBack, isHelpOpen, stack.length]),
  );
  const owes = details.totalDebtUsd > 0n;
  const safety = summarizeLoanSafety(loans, details.isError);
  const safetyCopy = loanSafetyCopy(safety);
  const safetyTitle = owes || details.isError ? safetyCopy.title : 'Nothing borrowed';
  const safetyDescription =
    safetyCopy.description ??
    (owes
      ? 'Assets can be sold if a loan falls below its sell point. Repaying moves it further away.'
      : undefined);
  const recentSales = showsLoanSafety
    ? []
    : [fuse.id, base.id].flatMap(chainId => {
        const sale = details.sales[chainId]?.find(
          event => now - event.timestamp < SALE_LOOKBACK_SECONDS,
        );
        return sale ? [{ chainId, sale }] : [];
      });
  const openSafety = () => router.push(path.CARD_LOAN_SAFETY);

  return (
    <PageLayout className="bg-[#111111]" desktopOnly scrollable={false}>
      <View className="mx-auto w-full max-w-[600px] flex-1">
        <View style={styles.header}>
          <BackButton
            variant="header"
            className="my-0 !h-[44px] !w-[44px]"
            onPress={goBack}
            icon={<CreditGlyph name="back" />}
          />
          <Text className="text-[18px] font-semibold text-white">
            {showsLoanSafety ? 'Loan safety' : 'Credit'}
          </Text>
          <Pressable
            accessibilityLabel="How collateral works"
            accessibilityRole="button"
            className="active:opacity-70"
            hitSlop={8}
            onPress={() => setIsHelpOpen(true)}
            style={styles.help}
          >
            <Text className="text-[18px] font-medium text-white/70">?</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isFirstLoad ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : (
            <>
              {!showsLoanSafety ? (
                <>
                  <View style={styles.summary}>
                    <Text className="text-[16px] font-medium text-white/70">Total borrowed</Text>
                    <Text className="text-[34px] font-semibold text-white">
                      {details.isError && !owes ? '—' : formatBalance(details.totalDebtUsd)}
                    </Text>
                  </View>
                  {owes ? <PillButton label="Repay" kind="primary" onPress={openRepay} /> : null}
                </>
              ) : null}

              {details.isError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={details.refetch}
                  style={styles.errorBar}
                >
                  <Text className="flex-1 text-[14px] text-white/80">
                    Part of your credit couldn’t be read. A loan may be missing.
                  </Text>
                  <Text className="text-[14px] font-semibold text-white">Try again</Text>
                </Pressable>
              ) : null}

              {showsLoanSafety ? (
                <>
                  <View style={styles.safetySummary}>
                    <Text className="text-center text-[24px] font-semibold text-white">
                      {safetyTitle}
                    </Text>
                    {safetyDescription ? (
                      <Text className="text-center text-[14px] leading-[20px] text-white/70">
                        {safetyDescription}
                      </Text>
                    ) : null}
                  </View>
                  {loans.length > 0 ? (
                    <View style={styles.card}>
                      {loans.map((loan, index) => {
                        const unlock = unlocks[loan.chainId];
                        return (
                          <View key={loan.chainId}>
                            {index ? <View style={styles.divider} /> : null}
                            <LoanCard
                              loan={loan}
                              now={now}
                              format={format}
                              formatBalance={formatBalance}
                              onRepay={() => open({ view: 'repay', chainId: loan.chainId })}
                              onUnlock={() =>
                                loan.assets.length > 1
                                  ? open({ view: 'pick-asset', chainId: loan.chainId })
                                  : open({
                                      view: 'unlock',
                                      chainId: loan.chainId,
                                      token: loan.assets[0].token,
                                    })
                              }
                              onUnlockAll={() => void unlockAll(loan)}
                              onPayDown={token =>
                                open({
                                  view: 'repay',
                                  chainId: loan.chainId,
                                  sourceId: `collateral:${token}`,
                                })
                              }
                              onAsset={token => openAsset(loan.chainId, token)}
                              onBreakdown={() => open({ view: 'breakdown', chainId: loan.chainId })}
                              onCancelUnlock={() => void cancelUnlock(loan)}
                              onFinishUnlock={() => void finishUnlock(loan)}
                              isCancelling={unlock.isCancelling}
                              isFinishing={unlock.isFinishing}
                              isUnlockingAll={unlock.isWithdrawingAll}
                              finishBlocked={
                                unlock.finishBlocked?.error.reason === 'needs-more-cover' &&
                                isSamePendingUnlock(unlock.finishBlocked.for, loan.pendingUnlock)
                                  ? unlock.finishBlocked.error.message
                                  : null
                              }
                            />
                          </View>
                        );
                      })}
                      <View style={styles.divider} />
                      <Pressable
                        accessibilityRole="button"
                        className="active:opacity-70"
                        onPress={() => setIsHelpOpen(true)}
                        style={styles.link}
                      >
                        <Text className="text-[14px] text-white/50">How it works</Text>
                        <CreditGlyph name="next" />
                      </Pressable>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  {owes ? (
                    <LoanSafetyBanner
                      summary={safety}
                      format={format}
                      formatBalance={formatBalance}
                      onPress={openSafety}
                    />
                  ) : loans.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      className="active:opacity-70"
                      onPress={openSafety}
                      style={[styles.card, styles.row]}
                    >
                      <Text className="flex-1 text-[16px] font-semibold text-white">
                        Manage locked collateral
                      </Text>
                      <CreditGlyph name="next" />
                    </Pressable>
                  ) : null}

                  {recentSales.map(({ chainId, sale }) => (
                    <SaleNotice
                      key={`${chainId}:${sale.transactionHash}`}
                      sale={sale}
                      loan={loans.find(loan => loan.chainId === chainId) ?? null}
                      knownAssets={details.positions[chainId]?.collateral ?? []}
                      format={format}
                      explorerTxUrl={explorerTxUrl(chainId)}
                    />
                  ))}

                  <View style={[styles.card, styles.padded]}>
                    <View style={styles.between}>
                      <Text className="text-[16px] text-white/70">Available to spend</Text>
                      <Text className="text-[16px] font-semibold text-white">
                        {details.availableToSpend}
                      </Text>
                    </View>
                    <View style={styles.usage}>
                      <View
                        style={[styles.usageFill, { width: `${details.borrowedProgress * 100}%` }]}
                      />
                    </View>
                    <Text className="text-[14px] text-white/50">
                      {`You’ve used ${details.borrowed} of your ${details.creditLimit} limit`}
                    </Text>
                  </View>

                  {details.collateral.length || details.canEditCollateralOrder ? (
                    <View style={styles.section}>
                      <View style={styles.sectionHeading}>
                        <Text className="text-[16px] text-white/50">Collateral</Text>
                        <CreditSectionHelp
                          label="Help with collateral"
                          onPress={() => setIsHelpOpen(true)}
                        />
                        {details.canEditCollateralOrder ? (
                          <Pressable
                            accessibilityLabel="Edit collateral order"
                            accessibilityRole="button"
                            className="ml-auto rounded-full bg-white/[0.12] px-3 py-1.5 active:opacity-80"
                            onPress={() => router.push(path.CARD_COLLATERAL_ORDER)}
                          >
                            <Text className="text-[14px] font-semibold text-white">Edit order</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {details.collateral.length > 0 ? (
                        <>
                          <View style={styles.card}>
                            {details.collateral.map((entry, index) => (
                              <View key={entry.key}>
                                {index ? <View style={styles.divider} /> : null}
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`${entry.name}, ${entry.value}, ${entry.locked}`}
                                  className="active:opacity-70"
                                  onPress={() => openAsset(entry.chainId, entry.asset.token)}
                                  style={styles.row}
                                >
                                  <CreditCollateralMark symbol={entry.asset.symbol} />
                                  <View style={styles.grow}>
                                    <Text className="text-[16px] font-semibold text-white">
                                      {entry.name}
                                    </Text>
                                    <Text className="text-[14px] text-white/60">{entry.terms}</Text>
                                  </View>
                                  <View style={styles.rowRight}>
                                    <Text className="text-right text-[16px] font-semibold text-white">
                                      {entry.value}
                                    </Text>
                                    <Text className="text-right text-[14px] text-white/60">
                                      {entry.locked}
                                    </Text>
                                  </View>
                                </Pressable>
                              </View>
                            ))}
                          </View>
                          <Text className="text-[14px] leading-[20px] text-white/50">
                            Only what you spend gets locked. Repay a loan to release its collateral,
                            or tap an asset to see what you can unlock early.
                          </Text>
                        </>
                      ) : null}
                    </View>
                  ) : null}

                  <AdditionalCollateral
                    assets={details.additionalCollateral}
                    heldAssets={details.collateral
                      .filter(entry => entry.asset.amount > 0n)
                      .map(entry => entry.asset)}
                    baseCollateralPreview={details.baseCollateralPreview}
                    isIncomplete={details.isCollateralDiscoveryIncomplete}
                    onHelpPress={() => setIsHelpOpen(true)}
                    onRetry={details.refetch}
                  />

                  {owes ? (
                    <View style={styles.section}>
                      <Text className="text-[16px] text-white/50">Interest</Text>
                      <View style={[styles.card, styles.row]}>
                        <View style={styles.iconCircle}>
                          <CreditGlyph name="interest" />
                        </View>
                        <View style={styles.grow}>
                          <Text className="text-[16px] font-semibold text-white">{`${details.borrowApy} APY`}</Text>
                          <Text className="text-[14px] text-white/60">{`Fixed · about ${details.monthlyInterest} a month`}</Text>
                        </View>
                      </View>
                    </View>
                  ) : null}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>

      <CreditSheet stack={stack} onStackChange={setStack} details={details} unlocks={unlocks} />
      <CollateralHelpSheet isOpen={isHelpOpen} onOpenChange={setIsHelpOpen} />
    </PageLayout>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 24,
  },
  help: {
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  content: { gap: 24, paddingBottom: 48, paddingHorizontal: 16, paddingTop: 24 },
  loading: { alignItems: 'center', paddingVertical: 80 },
  summary: { alignItems: 'center', gap: 6 },
  safetySummary: { alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  errorBar: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 181, 71, 0.1)',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  card: { backgroundColor: CREDIT_COLORS.card, borderRadius: 20, overflow: 'hidden' },
  padded: { gap: 12, padding: 16 },
  between: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  usage: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
  },
  usageFill: { backgroundColor: CREDIT_COLORS.green, borderRadius: 4, height: 8 },
  divider: { backgroundColor: '#2A2A2A', height: 1 },
  link: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  section: { gap: 12 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  grow: { flex: 1, gap: 2, minWidth: 0 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});

export default CreditDetailsScreen;
