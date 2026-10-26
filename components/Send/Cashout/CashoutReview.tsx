import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Info, Key } from 'lucide-react-native';
import { formatUnits, isAddress, parseUnits } from 'viem';

import DepositStepper from '@/components/DepositStepper';
import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { USDC_STARGATE } from '@/constants/addresses';
import { DEPOSIT_MODAL, SEND_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCashoutEntry, useCashoutKycNavigate, useCashoutUsdc } from '@/hooks/useCashout';
import {
  bridgePlanMessage,
  cashoutBridgePlanQuery,
  useCashoutBridge,
  useCashoutBridgePlan,
} from '@/hooks/useCashoutBridge';
import useCrossChainSend, { CrossChainSendQuoteExpiredError } from '@/hooks/useCrossChainSend';
import useSend from '@/hooks/useSend';
import {
  cashoutLimitsKey,
  useCreateTransfiCashoutOrder,
  useSubmitTransfiCashoutDeposit,
  useTransfiCashoutConfig,
  useTransfiCashoutPaymentMethods,
  useTransfiCashoutQuote,
} from '@/hooks/useTransfiCashout';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getTransfiCashoutOrder } from '@/lib/api';
import { bridgeShortfall } from '@/lib/cashoutBridge';
import { formatCashoutFiat, formatCashoutRate } from '@/lib/cashoutFormat';
import { limitsFromError } from '@/lib/cashoutLimits';
import { sanitizeTechnicalMessage } from '@/lib/errors';
import { maskPayoutDestination, payoutHolderName, validatePayoutDetails } from '@/lib/payoutFields';
import { kycUpgradeLevel, TRANSFI_ERROR_CODE, TransfiError } from '@/lib/transfiErrors';
import { TokenType, TransactionType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { CROSS_CHAIN_SEND_DECIMALS, formatLD, OWN_WALLET } from '@/lib/utils/cross-chain-send';
import { DepositProgressRow } from '@/lib/utils/deposit-steps';
import { useCashoutStore } from '@/store/useCashoutStore';
import { useSendStore } from '@/store/useSendStore';
import { useTransfiStore } from '@/store/useTransfiStore';

import type { TransfiCashoutDepositInstructions } from '@/lib/types';
import type { Address } from 'viem';

/** TransFi may price the deposit a hair off what was typed; more than this is refused. */
const DEPOSIT_TOLERANCE_USDC = '0.01';

/** A problem worth stopping for, and what the user can do about it. */
type ReviewProblem = {
  message: string;
  action: 'retry' | 'details' | 'amount' | 'activity' | 'none';
};

/** Raised by the checks made before any USDC moves. */
class DepositCheckError extends Error {}

/**
 * Round a decimal string up to `decimals` places. TransFi's deposit amount is
 * what its watcher expects; sending a fraction less would be an underpayment,
 * so anything past USDC's precision is rounded up, never down.
 */
const toDepositWei = (amount: string, decimals: number): bigint => {
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length <= decimals) return parseUnits(amount, decimals);
  const truncated = parseUnits(`${whole}.${fraction.slice(0, decimals)}`, decimals);
  return /[1-9]/.test(fraction.slice(decimals)) ? truncated + 1n : truncated;
};

/** The confirmed amount in token units, or undefined if it isn't a number. */
const toAmountWei = (amount: string, decimals: number): bigint | undefined => {
  try {
    return parseUnits(amount, decimals);
  } catch {
    return undefined;
  }
};

/**
 * Last cash-out step: confirm, open the order, send the USDC.
 *
 * Opening the order and sending happen on the one press, so the deposit
 * address is only ever the one the backend just returned for this order — never
 * typed, pasted or kept from an earlier session. Before anything is signed the
 * instructions are checked against what the user confirmed: right chain, a real
 * address, an amount they have and that matches what they typed.
 *
 * When the Base balance doesn't cover the amount, the press instead moves the
 * rest from Fuse to the user's own Base wallet (step 1). The bridge screen
 * brings them back here once it has landed, to open the order and send (step 2).
 */
export const CashoutReview = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setModal = useSendStore(state => state.setModal);
  const navigateKyc = useCashoutKycNavigate();
  const { startCashout } = useCashoutEntry();

  const currency = useCashoutStore(state => state.currency);
  const paymentCode = useCashoutStore(state => state.paymentCode);
  const details = useCashoutStore(state => state.paymentDetails);
  const usdcAmount = useCashoutStore(state => state.usdcAmount);
  const order = useCashoutStore(state => state.order);
  const setOrder = useCashoutStore(state => state.setOrder);
  const setDepositTxHash = useCashoutStore(state => state.setDepositTxHash);
  const setFieldErrors = useCashoutStore(state => state.setFieldErrors);
  const setTransfiError = useTransfiStore(state => state.setError);

  const { data: config } = useTransfiCashoutConfig();
  const { data: methods } = useTransfiCashoutPaymentMethods(currency);
  const method = methods?.find(m => m.paymentCode === paymentCode);
  const { data: quote } = useTransfiCashoutQuote(usdcAmount, currency, paymentCode);
  const usdc = useCashoutUsdc(config?.chainId);
  const { user } = useUser();
  const { source: bridgeSource } = useCashoutBridge(config?.chainId);
  const bridge = useCashoutStore(state => state.bridge);
  const setBridge = useCashoutStore(state => state.setBridge);

  const { values } = useMemo(
    () => validatePayoutDetails(method?.fields ?? [], details),
    [method?.fields, details],
  );
  const destination = maskPayoutDestination(method?.paymentName, values);
  const holder = payoutHolderName(values);

  const { send, totpModal } = useSend({
    tokenAddress: (usdc.tokenAddress ?? '0x') as Address,
    tokenDecimals: usdc.decimals ?? 6,
    tokenSymbol: 'USDC',
    chainId: config?.chainId ?? 0,
    tokenType: TokenType.ERC20,
  });
  const crossChain = useCrossChainSend();
  const createOrder = useCreateTransfiCashoutOrder();
  const submitDeposit = useSubmitTransfiCashoutDeposit();

  const [stage, setStage] = useState<'idle' | 'opening' | 'sending' | 'moving'>('idle');
  const [problem, setProblem] = useState<ReviewProblem>();

  // Step 1 is needed while the Base balance is short and nothing has moved yet.
  const decimals = usdc.decimals ?? 6;
  const shortfallWei =
    bridgeSource && !bridge && usdc.balanceWei != null
      ? bridgeShortfall(toAmountWei(usdcAmount, decimals), usdc.balanceWei)
      : 0n;
  const needsBridge = shortfallWei > 0n;
  const { data: bridgePlan, error: planError } = useCashoutBridgePlan(
    config?.chainId,
    shortfallWei,
    bridgeSource,
    needsBridge,
  );

  useEffect(() => {
    track(TRACKING_EVENTS.CASH_OUT_REVIEW_VIEWED, { currency, payment_code: paymentCode });
  }, [currency, paymentCode]);

  /** The order to fund: the one already open for this exact cash-out, or a new one. */
  const openOrder = async (): Promise<TransfiCashoutDepositInstructions> => {
    if (order) {
      try {
        const status = await withRefreshToken(() => getTransfiCashoutOrder(order.orderId));
        if (status.phase === 'awaiting_deposit' && !status.depositTxHash) return order;
      } catch {
        // Can't tell whether it is still open; a fresh order is the safe answer.
      }
    }
    const created = await createOrder.mutateAsync({
      usdcAmount,
      currency: currency as string,
      paymentCode: paymentCode as string,
      paymentDetails: values,
    });
    setOrder(created);
    track(TRACKING_EVENTS.CASH_OUT_ORDER_CREATED, {
      order_id: created.orderId,
      usdc_amount: Number(usdcAmount),
      currency,
      payment_code: paymentCode,
    });
    return created;
  };

  /** Everything checked before the user is asked to sign. Throws DepositCheckError. */
  const checkDeposit = (instructions: TransfiCashoutDepositInstructions): bigint => {
    const decimals = usdc.decimals ?? 6;
    if (!config || instructions.chainId !== config.chainId || !usdc.tokenAddress) {
      throw new DepositCheckError(
        'This cash-out is set up for a different network. Nothing was sent.',
      );
    }
    if (!isAddress(instructions.depositAddress)) {
      throw new DepositCheckError('We couldn’t verify where to send your USDC. Nothing was sent.');
    }
    const depositWei = toDepositWei(instructions.depositAmount, decimals);
    const requestedWei = parseUnits(usdcAmount, decimals);
    if (depositWei > requestedWei + parseUnits(DEPOSIT_TOLERANCE_USDC, decimals)) {
      throw new DepositCheckError(
        'Our payment partner asked for more USDC than you entered. Nothing was sent — review the amount and try again.',
      );
    }
    if (usdc.balanceWei != null && depositWei > usdc.balanceWei) {
      throw new DepositCheckError('You no longer have enough USDC for this. Nothing was sent.');
    }
    return depositWei;
  };

  const handleRefusal = (error: TransfiError) => {
    track(TRACKING_EVENTS.CASH_OUT_ORDER_FAILED, {
      code: error.code,
      action: error.action,
      currency,
      payment_code: paymentCode,
    });
    if (error.code === TRANSFI_ERROR_CODE.CASHOUT_INVALID_DETAILS) {
      setFieldErrors(error.details.fieldErrors ?? {});
      setModal(SEND_MODAL.OPEN_CASHOUT_DETAILS);
      return;
    }
    // Out of range on the order-time check: back to the amount, where the same
    // sentence shows on the field once these limits are in the cache.
    const limits = limitsFromError(error);
    if (limits) {
      queryClient.setQueryData(cashoutLimitsKey(currency, paymentCode), limits);
      setModal(SEND_MODAL.OPEN_CASHOUT_AMOUNT);
      return;
    }
    if (error.code === TRANSFI_ERROR_CODE.KYC_REQUIRED) {
      void startCashout();
      return;
    }
    // Past the limits of the user's verification level: TransFi's own page for
    // the next level, through the same screen buy crypto uses for it.
    if (kycUpgradeLevel(error) || error.action === 'complete_kyc') {
      setTransfiError(error, DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
      navigateKyc(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_ERROR);
      return;
    }
    setProblem({
      message: error.message,
      action:
        error.action === 'adjust_amount'
          ? 'amount'
          : error.action === 'change_payment_method'
            ? 'details'
            : error.action === 'retry'
              ? 'retry'
              : 'none',
    });
  };

  const handleConfirm = async () => {
    if (stage !== 'idle' || !currency || !paymentCode) return;
    setProblem(undefined);

    let instructions: TransfiCashoutDepositInstructions;
    let depositAmount: string;
    try {
      setStage('opening');
      instructions = await openOrder();
      depositAmount = formatUnits(checkDeposit(instructions), usdc.decimals ?? 6);
    } catch (error) {
      setStage('idle');
      if (error instanceof TransfiError) return handleRefusal(error);
      const message =
        error instanceof DepositCheckError
          ? error.message
          : 'We couldn’t open this cash-out. Nothing was sent — please try again.';
      setProblem({ message, action: 'retry' });
      return;
    }

    try {
      setStage('sending');
      const receipt = await send(depositAmount, instructions.depositAddress as Address, {
        type: TransactionType.CASH_OUT,
        title: `Cash out ${depositAmount} USDC`,
        shortTitle: 'Cash out',
        description: `Cash out to ${instructions.payoutLabel}`,
        metadata: {
          orderId: instructions.orderId,
          payoutLabel: instructions.payoutLabel,
          fiatCurrency: instructions.fiatCurrency,
        },
      });
      setDepositTxHash(receipt.transactionHash);
      // Recorded for support; the status screen polls TransFi either way.
      submitDeposit.mutate({ orderId: instructions.orderId, txHash: receipt.transactionHash });
      track(TRACKING_EVENTS.CASH_OUT_DEPOSIT_SENT, {
        order_id: instructions.orderId,
        usdc_amount: Number(depositAmount),
        currency,
      });
      setModal(SEND_MODAL.OPEN_CASHOUT_STATUS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cancelled = /cancel/i.test(message);
      track(TRACKING_EVENTS.CASH_OUT_DEPOSIT_FAILED, {
        order_id: instructions.orderId,
        cancelled,
        // Sanitized: a failed user operation's message carries the bundler URL,
        // API key included.
        error_message: sanitizeTechnicalMessage(error),
      });
      // A cancelled signature moved nothing, so the same order can be funded on
      // a second try. Any other failure may have happened after the transfer
      // went out — sending again could pay twice — so the way forward is
      // Activity, not the button.
      setProblem(
        cancelled
          ? { message: 'Transfer cancelled. Nothing was sent.', action: 'retry' }
          : {
              message:
                'We couldn’t confirm your transfer. Check Activity before trying again so you don’t send twice.',
              action: 'activity',
            },
      );
    } finally {
      setStage('idle');
    }
  };

  /** Step 1: move the shortfall from Fuse to the user's own wallet on Base. */
  const handleMove = async () => {
    if (stage !== 'idle' || !config || !bridgeSource || !user) return;
    setProblem(undefined);
    setStage('moving');

    let plan;
    try {
      // Priced again on the press: the one on screen may be minutes old.
      plan = await queryClient.fetchQuery({
        ...cashoutBridgePlanQuery(config.chainId, shortfallWei, bridgeSource),
        staleTime: 0,
      });
    } catch (error) {
      setStage('idle');
      setProblem({ message: bridgePlanMessage(error), action: 'amount' });
      return;
    }

    try {
      const result = await crossChain.send(
        {
          token: 'USDC',
          tokenAddress: USDC_STARGATE,
          dstChainId: config.chainId,
          networkName: bridgeSource.networkName,
          recipient: user.safeAddress as Address,
          exchange: OWN_WALLET,
          amount: formatUnits(BigInt(plan.amountLD), CROSS_CHAIN_SEND_DECIMALS),
          quote: plan,
        },
        { showStatus: false },
      );
      if (result.status === 'requote') {
        void queryClient.invalidateQueries({ queryKey: ['cashout-bridge', 'plan'] });
        setProblem({
          message: 'The bridge fee changed. Nothing was sent — check it and confirm again.',
          action: 'retry',
        });
        return;
      }
      setBridge({
        sendId: result.send.sendId,
        shortfallLD: shortfallWei.toString(),
        delivered: false,
      });
      track(TRACKING_EVENTS.CASH_OUT_BRIDGE_SENT, {
        send_id: result.send.sendId,
        shortfall_ld: shortfallWei.toString(),
        amount_ld: plan.amountLD,
        currency,
      });
      setModal(SEND_MODAL.OPEN_CASHOUT_BRIDGE);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      track(TRACKING_EVENTS.CASH_OUT_BRIDGE_FAILED, {
        error_message: sanitizeTechnicalMessage(error),
        currency,
      });
      // As with the send: a cancelled signature or an expired quote moved
      // nothing; anything else may have left Fuse, so Activity before a retry.
      if (error instanceof CrossChainSendQuoteExpiredError) {
        setProblem({ message: 'The quote expired. Nothing was sent.', action: 'retry' });
      } else if (/cancel/i.test(message)) {
        setProblem({ message: 'Transfer cancelled. Nothing was sent.', action: 'retry' });
      } else {
        setProblem({
          message:
            'We couldn’t confirm the move to Base. Check Activity before trying again so you don’t send twice.',
          action: 'activity',
        });
      }
    } finally {
      setStage('idle');
    }
  };

  const busy = stage !== 'idle';
  const fiat = quote && Number(quote.usdcAmount) === Number(usdcAmount) ? quote : undefined;
  const network = config?.tokenNetwork ?? 'Base';
  const shownProblem: ReviewProblem | undefined =
    problem ??
    (needsBridge && planError
      ? { message: bridgePlanMessage(planError), action: 'amount' }
      : undefined);

  // Keys are the stepper's own; only the labels are cash-out's.
  const sendStep = `Send ${usdcAmount} USDC to off-ramp provider`;
  const steps: DepositProgressRow[] | undefined = needsBridge
    ? [
        {
          key: 'received',
          label: `Move ${formatLD(shortfallWei.toString())} USDC to ${network}`,
          state: 'pending',
        },
        { key: 'confirmed', label: sendStep, state: 'pending' },
      ]
    : bridge?.delivered
      ? [
          { key: 'received', label: `Moved to ${network}`, state: 'complete' },
          { key: 'confirmed', label: sendStep, state: 'active' },
        ]
      : undefined;

  const baseWei = usdc.balanceWei ?? 0n;
  const from = !needsBridge
    ? `Wallet · USDC on ${network}`
    : baseWei > 0n
      ? `${formatLD(baseWei.toString())} ${network} + ${formatLD(shortfallWei.toString())} Fuse`
      : `${formatLD(shortfallWei.toString())} USDC on Fuse`;
  const rows = [
    holder ? { label: 'To', value: holder } : null,
    { label: 'Account', value: destination },
    { label: 'From', value: from },
    needsBridge && bridgePlan
      ? { label: 'Bridge fee', value: `${formatLD(bridgePlan.totalFeeLD)} USDC` }
      : null,
    fiat ? { label: 'Rate', value: formatCashoutRate(fiat, currency ?? '') } : null,
    fiat ? { label: 'Fees', value: formatCashoutFiat(fiat.totalFee, currency ?? '') } : null,
  ].filter(row => row !== null);

  return (
    <View className="gap-6">
      <View className="items-center gap-1 py-2">
        <Text className="text-sm text-white/50">You receive</Text>
        <Text className="text-3xl font-semibold">
          {formatCashoutFiat(fiat?.fiatAmount, currency ?? '')}
        </Text>
        <Text className="text-sm text-white/50">for {usdcAmount} USDC</Text>
      </View>

      <View className="rounded-2xl bg-card">
        {rows.map((row, index) => (
          <ReviewRow
            key={row.label}
            label={row.label}
            value={row.value}
            last={index === rows.length - 1}
          />
        ))}
      </View>

      {steps ? (
        <View className="gap-2">
          <DepositStepper rows={steps} />
          <Text className="px-1 text-xs text-white/50">
            {needsBridge
              ? `Moving to ${network} takes about ${bridgeSource?.etaMinutes} min. You approve the send once it lands.`
              : `Your USDC is in your ${network} wallet. Approve to send it.`}
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-start gap-2 px-1">
        <Info size={16} color="rgba(255,255,255,0.5)" />
        <Text className="flex-1 text-xs text-white/50">
          Your USDC goes to our off-ramp provider, who pays it out to your account. Check the
          account details — a payout can’t be redirected once it’s sent.
        </Text>
      </View>

      {shownProblem ? (
        <View className="gap-2 rounded-2xl bg-red-500/10 p-4">
          <Text className="text-sm text-red-300">{shownProblem.message}</Text>
          {shownProblem.action === 'details' ? (
            <Button variant="ghost" onPress={() => setModal(SEND_MODAL.OPEN_CASHOUT_DETAILS)}>
              <Text className="font-semibold">Edit account details</Text>
            </Button>
          ) : null}
          {shownProblem.action === 'amount' ? (
            <Button variant="ghost" onPress={() => setModal(SEND_MODAL.OPEN_CASHOUT_AMOUNT)}>
              <Text className="font-semibold">Change amount</Text>
            </Button>
          ) : null}
          {shownProblem.action === 'activity' ? (
            <Button
              variant="ghost"
              onPress={() => {
                setModal(SEND_MODAL.CLOSE);
                router.push(path.ACTIVITY);
              }}
            >
              <Text className="font-semibold">Go to Activity</Text>
            </Button>
          ) : null}
        </View>
      ) : null}

      <Button
        variant="brand"
        className="h-12 rounded-xl"
        size="lg"
        onPress={needsBridge ? handleMove : handleConfirm}
        disabled={
          busy ||
          shownProblem?.action === 'activity' ||
          shownProblem?.action === 'none' ||
          (needsBridge && (!bridgePlan || !!planError))
        }
      >
        <View className="flex-row items-center gap-2">
          {busy ? (
            <ActivityIndicator size="small" color="black" />
          ) : (
            <Key size={18} color="black" />
          )}
          <Text className="text-base font-bold text-black">
            {stage === 'opening'
              ? 'Preparing…'
              : stage === 'sending' || stage === 'moving'
                ? 'Sending…'
                : problem?.action === 'retry'
                  ? 'Try again'
                  : needsBridge
                    ? 'Confirm and move'
                    : bridge?.delivered
                      ? 'Approve and send'
                      : 'Confirm and send'}
          </Text>
        </View>
      </Button>

      <NeedHelp />
      {totpModal}
      {crossChain.totpModal}
    </View>
  );
};

const ReviewRow = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View
    className={`flex-row items-center justify-between gap-4 p-5 ${last ? '' : 'border-b border-foreground/10'}`}
  >
    <Text className="text-base text-muted-foreground">{label}</Text>
    <Text className="flex-1 text-right text-base font-semibold" numberOfLines={1}>
      {value}
    </Text>
  </View>
);

export default CashoutReview;
