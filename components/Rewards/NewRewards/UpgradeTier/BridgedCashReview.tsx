import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { KeyRound } from 'lucide-react-native';
import { formatUnits } from 'viem';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CHAIN_NAMES } from '@/constants/chains';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useLifiSwapCallback } from '@/hooks/swap/useLifiSwapCallback';
import { useBalances } from '@/hooks/useBalances';
import { type CashPayment, useCashFundingQuote } from '@/hooks/useTierUpgradeFunding';
import { track } from '@/lib/analytics';
import { getUserErrorMessage } from '@/lib/errors';
import { getTierDisplayName } from '@/lib/tierNames';
import { covers, formatUsd, formatUsdHeld } from '@/lib/tierUpgrade';
import { estimateFundingCoverUsd } from '@/lib/tierUpgradeFunding';
import { RewardsTier, TokenType } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { formatEta, lifiPriceImpact } from '@/lib/utils/swap/lifi';
import { warningSeverity } from '@/lib/utils/swap/prices';
import { useUserState } from '@/store/userStore';
import { useTierUpgradeStore } from '@/store/useTierUpgradeStore';

import TierDetailRow from './TierDetailRow';

/** USDC on Fuse, which is what every route here delivers. */
const BILLING_DECIMALS = 6;

interface BridgedCashReviewProps {
  tier: RewardsTier;
  feeUsd: number;
  payment: CashPayment;
}

/**
 * The review for paying the annual fee from another chain.
 *
 * Two signatures, in order, because they are on two chains: this one sends
 * the token to Fuse through LI.FI, and the progress step that follows starts
 * the membership once the USDC lands. Swapping first is the safe order — if
 * the user stops halfway, what they are left with is their own USDC on Fuse,
 * not a membership mandate with nothing behind it.
 *
 * The price shown is the fee, not the fee plus the bridge. What the route
 * costs on the way is absorbed by the first charge, up to the allowance the
 * backend enforces; the button stays off for a route that would lose more
 * than that, rather than letting the user pay for a membership that then
 * cannot start.
 */
const BridgedCashReview = ({ tier, feeUsd, payment }: BridgedCashReviewProps) => {
  const { token, needUsd, fuseUsdc, coverPct, billingTokenAddress } = payment;
  const { quote, fromAmount, isQuoting, error, refresh } = useCashFundingQuote({
    token,
    needUsd,
    billingTokenAddress,
    enabled: true,
  });
  const { swap, isSending } = useLifiSwapCallback();
  const { tokens: walletTokens } = useBalances();
  const { isExpertMode } = useUserState();
  const showFunding = useTierUpgradeStore(state => state.showFunding);
  const back = useTierUpgradeStore(state => state.back);
  const [failure, setFailure] = useState<string | null>(null);
  const executing = useRef(false);

  if (!token) return null;

  const chainName = CHAIN_NAMES[token.chainId] ?? 'another network';
  const symbol = token.contractTickerSymbol;
  const sendAmount = fromAmount ? Number(formatUnits(fromAmount, token.contractDecimals)) : 0;

  const sentUsd = Number(quote?.fromAmountUsd);
  const receivedUsd = quote ? Number(formatUnits(BigInt(quote.toAmount), BILLING_DECIMALS)) : 0;
  const minReceivedUsd = quote
    ? Number(formatUnits(BigInt(quote.toAmountMin), BILLING_DECIMALS))
    : 0;

  // Judged on the worst the quote allows to arrive, not the estimate: the user
  // signs once for the bridge, and a membership that then cannot start would
  // leave them with USDC they did not want to move.
  const worstCover = quote
    ? estimateFundingCoverUsd({
        feeUsd,
        fuseUsdc: fuseUsdc + minReceivedUsd,
        coverPct,
        sentUsd,
        receivedUsd: minReceivedUsd,
      })
    : 0;
  const coversFee = !!quote && covers(fuseUsdc + minReceivedUsd + worstCover, feeUsd);
  const lossUsd = Number.isFinite(sentUsd) ? Math.max(0, sentUsd - receivedUsd) : 0;

  // A bridge fee paid on top in the chain's gas token is not sponsored; the
  // Safe has to hold it on that chain.
  const requiredNative = quote ? BigInt(quote.transactionRequest.value || '0') : 0n;
  const native = walletTokens.find(
    held => held.chainId === token.chainId && held.type === TokenType.NATIVE,
  );
  const nativeShort =
    requiredNative > 0n && BigInt(native?.balance || '0') < requiredNative
      ? { symbol: native?.contractTickerSymbol ?? 'gas', required: requiredNative }
      : undefined;

  const priceImpact = lifiPriceImpact(quote);
  const severity = priceImpact ? warningSeverity(priceImpact) : 0;
  const priceImpactTooHigh = severity > 3 && !isExpertMode;

  const blocker =
    error ??
    (nativeShort
      ? token.type === TokenType.NATIVE
        ? `Not enough ${symbol} on ${chainName} for the amount plus the bridge fee. Try a little less, or another token.`
        : `This route needs ${formatNumber(Number(formatUnits(nativeShort.required, 18)), 6)} ${nativeShort.symbol} on ${chainName} for its bridge fee.`
      : undefined) ??
    (priceImpactTooHigh
      ? 'The price impact on this route is too high. Pick another token.'
      : undefined) ??
    (quote && !coversFee
      ? `This route loses more on the way than we can cover. Pick another token or top up your USDC on Fuse.`
      : undefined);

  const handlePay = async () => {
    if (executing.current || !quote) return;
    executing.current = true;
    setFailure(null);

    try {
      // LI.FI's calldata expires, so the quote on screen is never the one
      // signed — and a fresh one that now pays out less than the screen
      // promised is refused rather than quietly signed.
      const fresh = await refresh();
      if (!fresh) {
        setFailure('Could not refresh the quote. Try again.');
        return;
      }
      // The fresh quote's own worst case is what will be signed, so the check
      // that turned the button on is run again on it: a fresh estimate near
      // the old minimum carries a minimum a slippage band lower still.
      const freshMin = Number(formatUnits(BigInt(fresh.toAmountMin), BILLING_DECIMALS));
      const freshCover = estimateFundingCoverUsd({
        feeUsd,
        fuseUsdc: fuseUsdc + freshMin,
        coverPct,
        sentUsd: Number(fresh.fromAmountUsd),
        receivedUsd: freshMin,
      });
      if (
        BigInt(fresh.toAmount) < BigInt(quote.toAmountMin) ||
        !covers(fuseUsdc + freshMin + freshCover, feeUsd)
      ) {
        setFailure('The price changed. Check the new amount and try again.');
        return;
      }

      track(TRACKING_EVENTS.TIER_FUNDING_SWAP_PRESSED, {
        tier,
        price_usd: feeUsd,
        from_chain_id: fresh.fromChainId,
        from_token: fresh.fromToken.symbol,
        from_amount_usd: fresh.fromAmountUsd,
      });

      const result = await swap(fresh, { purpose: 'tier_upgrade' });
      if (result.kind === 'cancelled') return;

      track(TRACKING_EVENTS.TIER_FUNDING_SWAP_SENT, {
        tier,
        from_chain_id: fresh.fromChainId,
        transaction_hash: result.transactionHash,
      });

      // Every route from another chain is cross-chain, so this is the
      // expected outcome. A same-chain completion would mean the USDC is
      // already on Fuse, and the offer step can take it from there.
      if (result.kind === 'bridging') showFunding();
      else back();
    } catch (swapError) {
      track(TRACKING_EVENTS.TIER_FUNDING_SWAP_FAILED, { tier });
      setFailure(
        getUserErrorMessage(swapError, { action: 'swap' }) ||
          'Unable to send your payment. Please try again.',
      );
    } finally {
      executing.current = false;
    }
  };

  const isBusy = isSending || isQuoting;

  return (
    <View className="mx-auto w-full max-w-[414px]">
      <View className="overflow-hidden rounded-[20px] bg-[#1C1C1C]">
        <TierDetailRow label="Tier" value={getTierDisplayName(tier)} withDivider />
        <TierDetailRow label="Paying with" value={`${symbol} on ${chainName}`} withDivider />
        <TierDetailRow label="Amount" value={formatUsd(feeUsd)} withDivider />
        {fuseUsdc >= 0.01 ? (
          <TierDetailRow
            label="From your USDC on Fuse"
            value={formatUsdHeld(Math.min(fuseUsdc, feeUsd))}
            withDivider
          />
        ) : null}
        <TierDetailRow
          label="You send"
          value={sendAmount > 0 ? `${formatNumber(sendAmount, 6)} ${symbol}` : '—'}
          secondaryValue={Number.isFinite(sentUsd) ? `≈ ${formatUsd(sentUsd)}` : undefined}
          withDivider
        >
          {isQuoting ? <ActivityIndicator size="small" color="white" /> : undefined}
        </TierDetailRow>
        <TierDetailRow
          label="Bridge fees"
          value={quote ? (coversFee ? 'Covered' : formatUsd(lossUsd)) : '—'}
          valueClassName={coversFee ? 'text-[#94F27F]' : undefined}
          secondaryValue={quote && coversFee && lossUsd >= 0.01 ? formatUsd(lossUsd) : undefined}
          tooltip={`What the bridge and any swap on the way take comes off your first payment, up to ${coverPct}% of the fee. You pay ${formatUsd(feeUsd)}, not more.`}
          tooltipAnalyticsContext="tier_upgrade_bridge_fees"
          withDivider
        />
        <TierDetailRow
          label="Arrives in"
          value={quote ? formatEta(quote.executionDurationSeconds).replace('~', '') : '—'}
          withDivider
        />
        <TierDetailRow label="Billed" value="Once a year" />
      </View>

      <Text className="mt-6 text-center text-[15px] leading-5 text-white/50">
        {`We move your ${symbol} to USDC on Fuse, then you confirm the membership once it lands. It renews once a year at ${formatUsd(feeUsd)} from your USDC on Fuse — cancel any time.`}
      </Text>

      {failure || blocker ? (
        <Text className="mt-4 text-center text-[14px] leading-5 text-red-400">
          {failure ?? blocker}
        </Text>
      ) : null}

      <Button
        variant="brand"
        onPress={() => void handlePay()}
        disabled={isBusy || !quote || !!blocker}
        className="mt-8 h-14 flex-row items-center justify-center gap-2 rounded-full"
      >
        <KeyRound color="black" size={18} strokeWidth={2} />
        <Text className="text-base font-bold text-black">
          {isSending ? 'Sending…' : isQuoting ? 'Finding a route…' : `Pay with ${symbol}`}
        </Text>
      </Button>
    </View>
  );
};

export default BridgedCashReview;
