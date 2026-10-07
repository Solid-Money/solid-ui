import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Info, Key } from 'lucide-react-native';
import { formatUnits, isAddress, parseUnits } from 'viem';

import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL, SEND_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCashoutEntry, useCashoutKycNavigate, useCashoutUsdc } from '@/hooks/useCashout';
import useSend from '@/hooks/useSend';
import {
  useCreateTransfiCashoutOrder,
  useSubmitTransfiCashoutDeposit,
  useTransfiCashoutConfig,
  useTransfiCashoutPaymentMethods,
  useTransfiCashoutQuote,
} from '@/hooks/useTransfiCashout';
import { track } from '@/lib/analytics';
import { getTransfiCashoutOrder } from '@/lib/api';
import { formatCashoutFiat, formatCashoutRate } from '@/lib/cashoutFormat';
import { maskPayoutDestination, payoutHolderName, validatePayoutDetails } from '@/lib/payoutFields';
import { kycUpgradeLevel, TRANSFI_ERROR_CODE, TransfiError } from '@/lib/transfiErrors';
import { TokenType, TransactionType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
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

/**
 * Last cash-out step: confirm, open the order, send the USDC.
 *
 * Opening the order and sending happen on the one press, so the deposit
 * address is only ever the one the backend just returned for this order — never
 * typed, pasted or kept from an earlier session. Before anything is signed the
 * instructions are checked against what the user confirmed: right chain, a real
 * address, an amount they have and that matches what they typed.
 */
export const CashoutReview = () => {
  const router = useRouter();
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
  const createOrder = useCreateTransfiCashoutOrder();
  const submitDeposit = useSubmitTransfiCashoutDeposit();

  const [stage, setStage] = useState<'idle' | 'opening' | 'sending'>('idle');
  const [problem, setProblem] = useState<ReviewProblem>();

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
        error_message: message,
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

  const busy = stage !== 'idle';
  const fiat = quote && Number(quote.usdcAmount) === Number(usdcAmount) ? quote : undefined;

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
        {holder ? <ReviewRow label="To" value={holder} /> : null}
        <ReviewRow label="Account" value={destination} />
        <ReviewRow label="From" value={`Wallet · USDC on ${config?.tokenNetwork ?? 'Base'}`} />
        {fiat ? <ReviewRow label="Rate" value={formatCashoutRate(fiat, currency ?? '')} /> : null}
        {fiat ? (
          <ReviewRow label="Fees" value={formatCashoutFiat(fiat.totalFee, currency ?? '')} last />
        ) : null}
      </View>

      <View className="flex-row items-start gap-2 px-1">
        <Info size={16} color="rgba(255,255,255,0.5)" />
        <Text className="flex-1 text-xs text-white/50">
          Your USDC goes to TransFi, our payout partner, who pays it out to your account. Check the
          account details — a payout can’t be redirected once it’s sent.
        </Text>
      </View>

      {problem ? (
        <View className="gap-2 rounded-2xl bg-red-500/10 p-4">
          <Text className="text-sm text-red-300">{problem.message}</Text>
          {problem.action === 'details' ? (
            <Button variant="ghost" onPress={() => setModal(SEND_MODAL.OPEN_CASHOUT_DETAILS)}>
              <Text className="font-semibold">Edit account details</Text>
            </Button>
          ) : null}
          {problem.action === 'amount' ? (
            <Button variant="ghost" onPress={() => setModal(SEND_MODAL.OPEN_CASHOUT_AMOUNT)}>
              <Text className="font-semibold">Change amount</Text>
            </Button>
          ) : null}
          {problem.action === 'activity' ? (
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
        onPress={handleConfirm}
        disabled={busy || problem?.action === 'activity' || problem?.action === 'none'}
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
              : stage === 'sending'
                ? 'Sending…'
                : problem?.action === 'retry'
                  ? 'Try again'
                  : 'Confirm and send'}
          </Text>
        </View>
      </Button>

      <NeedHelp />
      {totpModal}
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
