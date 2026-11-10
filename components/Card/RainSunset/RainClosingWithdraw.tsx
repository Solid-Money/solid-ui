import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { formatUnits } from 'viem';

import PageLayout from '@/components/PageLayout';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardCollateralAvailable } from '@/hooks/useCardCollateralAvailable';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { RAIN_SUNSET_BALANCE_KEY, useRainSunset } from '@/hooks/useRainSunset';
import useUser from '@/hooks/useUser';
import useWithdrawRainCollateral from '@/hooks/useWithdrawRainCollateral';
import { getAsset } from '@/lib/assets';
import { showFailureSheet } from '@/lib/errors';
import getTokenIcon from '@/lib/getTokenIcon';
import { isCancelledByUser } from '@/lib/utils/passkeyErrors';
import {
  floorCents,
  formatClosingBalance,
  formatClosingDate,
  tokenWithdrawal,
  unitsToCents,
} from '@/lib/utils/rainSunset';

/** The token-logo pop from Figma's motion (cubic-bezier(0.22, 1, 0.36, 1), 18%→39% of 2s). */
const POP_DELAY_MS = 360;
const POP_DURATION_MS = 420;
const POP_STAGGER_MS = 80;
const POP_EASING = Easing.bezier(0.22, 1, 0.36, 1);

const TokenLogoPop = ({ symbol, index }: { symbol: string; index: number }) => {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      POP_DELAY_MS + index * POP_STAGGER_MS,
      withTiming(1, { duration: POP_DURATION_MS, easing: POP_EASING }),
    );
  }, [index, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 2.8),
    transform: [{ scale: progress.value }],
  }));
  return (
    <Animated.View style={[styles.tokenLogo, style]}>
      <RenderTokenIcon tokenIcon={getTokenIcon({ tokenSymbol: symbol })} size={32} />
    </Animated.View>
  );
};

type Phase =
  | { kind: 'review' }
  | { kind: 'withdrawing'; step: number }
  | { kind: 'done'; usd: number };

/**
 * Withdraw the whole balance on a closing card to the wallet (Figma "5 · Withdraw
 * card balance" and "6 · Withdraw done").
 *
 * Every token on the card, no amount field: the card is closing, so there is no
 * reason to leave anything on it. Each token is its own collateral withdrawal —
 * today's `useWithdrawRainCollateral`, one `withdrawAsset` per token — so a card
 * holding two tokens asks for the passkey twice, and the screen says so.
 */
export function RainClosingWithdraw() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { sunset } = useRainSunset();
  const { data: collateral, isLoading, isError, refetch } = useCardCollateralAvailable();
  const { withdrawCollateral } = useWithdrawRainCollateral();
  const [phase, setPhase] = useState<Phase>({ kind: 'review' });

  const tokens = useMemo(
    () =>
      (collateral?.tokens ?? []).filter(
        token => !token.unavailableReason && token.balanceUsd >= 0.01,
      ),
    [collateral],
  );
  const totalUsd = tokens.reduce((sum, token) => sum + token.balanceUsd, 0);
  const closesOn = formatClosingDate(sunset?.closesAt);
  // No answer at all is not an empty card: say so and offer to read it again.
  const unreadable = !collateral && isError;

  const goToCard = () => router.replace(path.CARD_INFO);

  /**
   * Withdraw every token from `start` on. A retry after a failure resumes at
   * the token that failed, with the cap and the total already moved carried
   * over: the tokens before it are empty now, so starting again from the first
   * would ask for money that is no longer there.
   *
   * The cap (Rain's spending power) and what has moved are kept in whole
   * cents, in integers: what a token uses of the cap is rounded up, so the cap
   * left is never overstated.
   */
  const withdrawAll = async (
    start: { index: number; capCents: bigint | undefined; movedCents: bigint } = {
      index: 0,
      capCents:
        collateral?.spendingPowerUsd === undefined
          ? undefined
          : floorCents(collateral.spendingPowerUsd),
      movedCents: 0n,
    },
  ) => {
    if (!user?.safeAddress || tokens.length === 0) return;
    let capCents = start.capCents;
    let movedCents = start.movedCents;
    let index = start.index;
    try {
      for (; index < tokens.length; index++) {
        const token = tokens[index];
        if (capCents !== undefined && capCents < 1n) break;
        const { units, amount } = tokenWithdrawal(token, capCents);
        if (units === 0n) continue;
        setPhase({ kind: 'withdrawing', step: index });
        await withdrawCollateral({
          amount,
          recipientAddress: user.safeAddress,
          chainId: token.chainId,
          tokenAddress: token.tokenAddress,
        });
        movedCents += unitsToCents(units, token.decimals, 'down');
        if (capCents !== undefined) {
          const used = unitsToCents(units, token.decimals, 'up');
          capCents = used >= capCents ? 0n : capCents - used;
        }
      }
      if (movedCents === 0n) {
        // Nothing moved — Rain is holding the whole balance against its credit
        // line (pending payments). "In your wallet" would be wrong: stay on the
        // review, which re-reads the card, and say why.
        setPhase({ kind: 'review' });
        Toast.show({
          type: 'info',
          text1: 'Nothing could be withdrawn yet',
          text2: 'Your card is holding its balance for pending payments. Try again shortly.',
          props: { badgeText: '' },
        });
        return;
      }
      setPhase({ kind: 'done', usd: Number(movedCents) / 100 });
    } catch (error) {
      // Back to the review, which re-reads the card and shows what is still on
      // it — never "done", which would say the whole balance is in the wallet.
      setPhase({ kind: 'review' });
      if (!isCancelledByUser(error)) {
        const resumeFrom = { index, capCents, movedCents };
        void showFailureSheet(error, {
          action: 'card_withdraw',
          title: 'Couldn’t withdraw your card balance',
          onRetry: () => void withdrawAll(resumeFrom),
        });
      }
    } finally {
      void refetch();
      queryClient.invalidateQueries({ queryKey: [RAIN_SUNSET_BALANCE_KEY] });
      queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });
    }
  };

  if (phase.kind === 'done') {
    return (
      <PageLayout desktopOnly scrollable={false}>
        <View className="mx-auto w-full max-w-lg flex-1 px-6">
          <View style={styles.doneContent}>
            <Image
              source={getAsset('images/card-withdraw-success.svg')}
              style={styles.success}
              contentFit="contain"
            />
            <Text className="text-center text-[26px] font-semibold leading-[32px] text-white">
              {formatClosingBalance(phase.usd)} is in your wallet
            </Text>
            <Text className="text-center text-[16px] leading-[22px] text-white/70">
              Your card balance is now in your wallet. Use it for Earn, Send or swaps right away.
            </Text>
            {sunset?.newCardAvailable ? (
              <View style={styles.nextStep}>
                <Text className="text-[16px] font-semibold text-white">
                  Next: your new Solid card
                </Text>
                <Text className="text-[14px] leading-[20px] text-white/70">
                  Get it now from the card screen. It spends straight from your wallet, so this
                  balance is ready to use.
                </Text>
              </View>
            ) : null}
          </View>
          <View className="pb-6 pt-3">
            {sunset?.newCardAvailable ? (
              <Button
                variant="brand"
                className="mb-2 h-[54px] rounded-full"
                onPress={() => router.replace(path.CARD_NEW_CARD)}
              >
                <Text className="text-[17px] font-semibold text-black">Get your new card</Text>
              </Button>
            ) : null}
            <Button onPress={goToCard} className="h-[54px] rounded-full bg-white">
              <Text className="text-[17px] font-semibold text-black">Done</Text>
            </Button>
          </View>
        </View>
      </PageLayout>
    );
  }

  const withdrawing = phase.kind === 'withdrawing';
  const confirmations =
    tokens.length > 1
      ? `You'll confirm with your passkey, once for each of the ${tokens.length} tokens.`
      : "You'll confirm with your passkey.";
  const stays = closesOn
    ? ` Your card keeps working until ${closesOn.long}.`
    : ' Your card keeps working until it closes.';

  return (
    <PageLayout desktopOnly scrollable={false}>
      <View className="mx-auto w-full max-w-lg flex-1 px-6 pt-4">
        <View style={styles.header}>
          <BackButton onPress={goToCard} />
          <Text className="text-[20px] font-semibold text-white">Withdraw card balance</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.amount}>
            <Text className="text-[15px] text-white/60">Your card balance</Text>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : unreadable ? (
              <Text className="text-center text-[17px] font-medium text-white">
                We couldn’t read your card balance
              </Text>
            ) : (
              <Text className="text-[48px] font-semibold text-white">
                {formatClosingBalance(totalUsd)}
              </Text>
            )}
            <Text className="text-[14px] text-white/50">All of it moves to your wallet</Text>
          </View>

          {tokens.length > 0 ? (
            <View style={styles.section}>
              <Text className="text-[15px] font-medium text-white/60">From your card</Text>
              <View style={styles.list}>
                {tokens.map((token, index) => (
                  <View key={`${token.chainId}:${token.tokenAddress}`}>
                    {index > 0 ? <View style={styles.divider} /> : null}
                    <View style={styles.row}>
                      <TokenLogoPop symbol={token.symbol} index={index} />
                      <View style={styles.rowText}>
                        <Text className="text-[16px] font-medium text-white">{token.symbol}</Text>
                        <Text className="text-[13px] text-white/50">
                          {Number(
                            formatUnits(BigInt(token.rawBalance || '0'), token.decimals),
                          ).toFixed(2)}{' '}
                          {token.symbol}
                        </Text>
                      </View>
                      <Text className="text-[16px] font-medium text-white">
                        {formatClosingBalance(token.balanceUsd)}
                      </Text>
                      {withdrawing && phase.step === index ? (
                        <ActivityIndicator color="#94F27F" style={styles.rowSpinner} />
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text className="text-[15px] font-medium text-white/60">To</Text>
            <View style={[styles.list, styles.walletRow]}>
              <Image
                source={getAsset('images/card-closing-wallet.svg')}
                style={styles.walletIcon}
                contentFit="contain"
              />
              <View style={styles.rowText}>
                <Text className="text-[16px] font-medium text-white">Your wallet</Text>
                <Text className="text-[13px] text-white/50">Ready to use right away</Text>
              </View>
            </View>
          </View>

          <Text className="text-[14px] leading-[20px] text-white/50">
            {confirmations}
            {stays}
          </Text>
        </ScrollView>

        <View className="pb-6 pt-3">
          <Button
            variant="brand"
            className="h-[54px] rounded-full"
            disabled={withdrawing || isLoading || (!unreadable && tokens.length === 0)}
            onPress={() => (unreadable ? void refetch() : void withdrawAll())}
          >
            {withdrawing ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text className="text-[17px] font-semibold text-black">
                {unreadable
                  ? 'Try again'
                  : tokens.length === 0 && !isLoading
                    ? 'Nothing to withdraw'
                    : `Withdraw ${formatClosingBalance(totalUsd)}`}
              </Text>
            )}
          </Button>
        </View>
      </View>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  content: { gap: 24, paddingTop: 28, paddingBottom: 24 },
  amount: { alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 8 },
  section: { gap: 10 },
  list: {
    backgroundColor: '#1C1C1C',
    borderRadius: 23,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowText: { flex: 1, gap: 2 },
  rowSpinner: { marginLeft: 8 },
  tokenLogo: { width: 32, height: 32 },
  walletIcon: { width: 32, height: 32 },
  doneContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  success: { width: 88, height: 88 },
  nextStep: {
    alignSelf: 'stretch',
    gap: 4,
    backgroundColor: '#1C1C1C',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
});

export default RainClosingWithdraw;
