import { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Linking, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Wallet as WalletIcon } from 'lucide-react-native';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import ToDestinationSelector, { assetLabel } from '@/components/Card/ToDestinationSelector';
import Max from '@/components/Max';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { CARD_WITHDRAW_MODAL } from '@/constants/modals';
import { useCardCollateralAvailable } from '@/hooks/useCardCollateralAvailable';
import { useCardDetails } from '@/hooks/useCardDetails';
import useUser from '@/hooks/useUser';
import useWithdrawRainCollateral from '@/hooks/useWithdrawRainCollateral';
import { withdrawFromCard, withdrawFromCardToSavings } from '@/lib/api';
import { EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID } from '@/lib/config';
import { CardProvider } from '@/lib/types';
import { cn, formatNumber, getCardDepositTokenSymbol } from '@/lib/utils';
import { toAmountInputValue } from '@/lib/utils/cardHelpers';
import { CardDepositSource } from '@/store/useCardDepositStore';
import { useCardWithdrawStore } from '@/store/useCardWithdrawStore';

type FormData = { amount: string; to: CardDepositSource };

function getExplorerTxUrl(_chainId: number | undefined, txHash: string): string {
  return `https://blockscan.com/tx/${txHash}`;
}

export default function CardWithdrawForm() {
  const { user } = useUser();
  const { data: cardDetails, refetch, isLoading: isCardDetailsLoading } = useCardDetails();
  // Undefined until the user picks: the backend then opens on the richest
  // asset, which is the one worth withdrawing.
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string | undefined>();
  const {
    data: collateral,
    refetch: refetchCollateral,
    isLoading: isCollateralLoading,
  } = useCardCollateralAvailable(selectedTokenAddress);
  const { setModal, setTransaction } = useCardWithdrawStore(
    useShallow(state => ({ setModal: state.setModal, setTransaction: state.setTransaction })),
  );

  const spendableAmount = Number(cardDetails?.balances?.available?.amount ?? 0);
  const formattedBalance = formatNumber(spendableAmount, 2, 2);

  const { withdrawCollateral } = useWithdrawRainCollateral();

  // The asset the withdrawal will actually move. The backend priced
  // `availableUsd` against exactly this token, so taking chain + address from
  // the same response keeps the validated amount and the signed withdrawal on
  // the same asset.
  const withdrawChainId = collateral?.chainId ?? EXPO_PUBLIC_CARD_FUNDING_CHAIN_ID;
  const fundingTokenAddress = collateral?.tokenAddress;

  const depositTokenSymbol = getCardDepositTokenSymbol(CardProvider.RAIN);
  const assetSymbol = collateral?.symbol || depositTokenSymbol;

  // A collateral withdrawal moves real tokens out of the Rain collateral proxy,
  // so it is capped by that proxy's on-chain balance of THIS asset — not by the
  // card's spending balance, which is Rain's credit-side spending power and is
  // credited against every asset at once. A $100.60 spending balance can sit on
  // $100.53 of USDT and $0.42 of USDC; only one of those is withdrawable per
  // transaction, and neither equals the balance.
  const collateralAvailable = collateral?.availableUsd ?? 0;
  const collateralFormatted = formatNumber(collateralAvailable, 2, 2);

  const { control, handleSubmit, formState, watch, setValue, setError, clearErrors, trigger } =
    useForm<FormData>({
      mode: 'onChange',
      defaultValues: {
        amount: '',
        to: CardDepositSource.COLLATERAL,
      },
    });

  const watchedAmount = watch('amount');
  const watchedTo = watch('to');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCollateral = watchedTo === CardDepositSource.COLLATERAL;

  const schema = useMemo(
    () =>
      z.object({
        amount: z
          .string()
          .refine(val => val !== '' && !isNaN(Number(val)), { message: 'Enter a valid amount' })
          .refine(val => Number(val) >= 1, { message: 'Minimum withdrawal is $1' })
          .refine(val => Number(val) <= spendableAmount, {
            message: `Amount exceeds spendable balance (${formattedBalance} available)`,
          }),
      }),
    [spendableAmount, formattedBalance],
  );

  const collateralSchema = useMemo(
    () =>
      z.object({
        amount: z
          .string()
          .refine(val => val !== '' && !isNaN(Number(val)), { message: 'Enter a valid amount' })
          .refine(val => Number(val) >= 1, { message: 'Minimum withdrawal is $1' })
          .refine(val => Number(val) <= collateralAvailable, {
            // Name the asset: "$0.42 available" is baffling next to a $100.60
            // card balance unless it says which asset that $0.42 is.
            message:
              collateralAvailable > 0
                ? `Amount exceeds available ($${collateralFormatted} of ${assetSymbol} available to withdraw)`
                : `No ${assetSymbol} is available to withdraw right now`,
          }),
      }),
    [collateralAvailable, collateralFormatted, assetSymbol],
  );

  const validationError = useMemo(() => {
    if (isCollateral) {
      if (!watchedAmount) return null;
      // The available figure starts at 0 until the on-chain read lands; don't
      // accuse the user of over-withdrawing before we know the balance.
      if (isCollateralLoading) return null;
      const parsed = collateralSchema.safeParse({ amount: watchedAmount });
      if (parsed.success) return null;
      return parsed.error.issues[0]?.message ?? null;
    }
    if (!watchedAmount) return null;
    try {
      schema.parse({ amount: watchedAmount });
      return null;
    } catch (error: unknown) {
      const err = error as { issues?: { message?: string }[] };
      return err.issues?.[0]?.message ?? null;
    }
  }, [watchedAmount, isCollateral, isCollateralLoading, schema, collateralSchema]);

  const onSubmit = useCallback(
    async (data: FormData) => {
      const toSavings = data.to === CardDepositSource.SAVINGS;
      const toCollateral = data.to === CardDepositSource.COLLATERAL;

      if (toCollateral) {
        const parsed = collateralSchema.safeParse({ amount: data.amount });
        if (!parsed.success) {
          const msg = parsed.error.issues[0]?.message ?? 'Invalid input';
          setError('amount', { message: msg });
          return;
        }
      } else {
        const parsed = schema.safeParse({ amount: data.amount });
        if (!parsed.success) {
          const message = parsed.error.issues[0]?.message ?? 'Enter a valid amount';
          setError('amount', { message });
          return;
        }
      }

      if (!toSavings && !toCollateral && !user?.safeAddress) {
        Toast.show({
          type: 'error',
          text1: 'Safe address not found',
          text2: 'Please try again',
        });
        return;
      }

      setIsSubmitting(true);
      try {
        if (toSavings) {
          const res = await withdrawFromCardToSavings({ amount: data.amount });
          setTransaction({
            amount: Number(data.amount),
            clientTxId: `card-${res.withdrawalId}`,
            to: data.to,
          });
          setModal(CARD_WITHDRAW_MODAL.OPEN_TRANSACTION_STATUS);
          await refetch();
          Toast.show({
            type: 'success',
            text1: 'Withdrawal to Savings requested',
            text2: `$${data.amount} is being sent to your Savings.`,
          });
        } else if (toCollateral) {
          const res = await withdrawCollateral({
            amount: data.amount,
            recipientAddress: user!.safeAddress!,
            ...(withdrawChainId != null && { chainId: withdrawChainId }),
            ...(fundingTokenAddress && { tokenAddress: fundingTokenAddress }),
          });
          const txHash = res.transactionHash;
          setTransaction({
            amount: Number(data.amount),
            clientTxId: txHash,
            to: data.to,
            transactionHash: txHash,
            chainId: withdrawChainId,
          });
          setModal(CARD_WITHDRAW_MODAL.OPEN_TRANSACTION_STATUS);
          await Promise.all([refetch(), refetchCollateral()]);
          const explorerUrl = getExplorerTxUrl(withdrawChainId, txHash);
          Toast.show({
            type: 'success',
            text1: 'Withdrawal started',
            text2: `$${data.amount} ${assetSymbol} collateral withdrawal.`,
            onPress: () => Linking.openURL(explorerUrl),
            props: { badgeText: 'Onchain' },
          });
        } else {
          const response = await withdrawFromCard({
            amount: data.amount,
            destination: {
              chain: 'ethereum',
              address: user!.safeAddress!,
            },
          });

          setTransaction({
            amount: Number(data.amount),
            clientTxId: `card-${response.id}`,
            to: data.to,
          });
          setModal(CARD_WITHDRAW_MODAL.OPEN_TRANSACTION_STATUS);
          await refetch();

          const txHash = response.destination?.tx_hash;
          const etherscanUrl = txHash ? `https://etherscan.io/tx/${txHash}` : null;
          Toast.show({
            type: 'success',
            text1: 'Withdrawal requested',
            text2: etherscanUrl ? etherscanUrl : `$${data.amount} is being sent to your wallet.`,
            ...(etherscanUrl && {
              onPress: () => Linking.openURL(etherscanUrl),
            }),
          });
        }
      } catch (err: unknown) {
        let message = 'Withdrawal failed';
        if (err instanceof Response) {
          const body = await err.json().catch(() => ({}));
          message = (body as { message?: string })?.message ?? err.statusText ?? message;
        } else if (err instanceof Error) {
          message = err.message;
        }
        // Collateral can move between the read and the submit (a charge settles,
        // a deposit lands), so re-read it before the user retries.
        if (toCollateral) void refetchCollateral();
        Toast.show({ type: 'error', text1: 'Withdrawal failed', text2: message });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      user,
      setModal,
      setTransaction,
      refetch,
      refetchCollateral,
      schema,
      collateralSchema,
      setError,
      withdrawChainId,
      fundingTokenAddress,
      assetSymbol,
      withdrawCollateral,
    ],
  );

  const isAvailableLoading = isCollateral ? isCollateralLoading : isCardDetailsLoading;
  const disabled = isSubmitting;
  const availableFormatted = isCollateral ? collateralFormatted : formattedBalance;

  /** Assets other than the selected one that still hold a balance. */
  const otherFundedAssets = useMemo(
    () =>
      (collateral?.tokens ?? []).filter(
        t =>
          !t.unavailableReason &&
          t.balanceUsd > 0 &&
          t.tokenAddress.toLowerCase() !== collateral?.tokenAddress?.toLowerCase(),
      ),
    [collateral],
  );

  // The card's spending balance and its withdrawable collateral are different
  // numbers; say so when they diverge, rather than letting the user discover it
  // through a rejected withdrawal. When the shortfall is only because the rest
  // sits in another asset, say that instead — the money is not missing, it just
  // has to be withdrawn one asset at a time.
  const collateralShortfallHint = useMemo(() => {
    if (!isCollateral || isCollateralLoading || !collateral) return null;
    if (collateralAvailable >= spendableAmount) return null;

    if (otherFundedAssets.length) {
      const others = otherFundedAssets
        .map(t => `$${formatNumber(t.balanceUsd, 2, 2)} of ${assetLabel(t)}`)
        .join(', ');
      return `You can withdraw $${collateralFormatted} of ${assetSymbol} now. The rest of your $${formattedBalance} balance is held as ${others} — switch asset above to withdraw it.`;
    }
    return `Your card balance is $${formattedBalance}, but only $${collateralFormatted} of ${assetSymbol} is currently available to withdraw.`;
  }, [
    isCollateral,
    isCollateralLoading,
    collateral,
    collateralAvailable,
    spendableAmount,
    otherFundedAssets,
    collateralFormatted,
    formattedBalance,
    assetSymbol,
  ]);

  return (
    <View className="gap-3">
      {/* Amount */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium opacity-50">Amount</Text>

          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1">
              <WalletIcon color="#A1A1A1" size={16} />
              {isAvailableLoading ? (
                <Skeleton className="h-5 w-14 rounded-md" />
              ) : (
                <Text className="font-medium opacity-50">${availableFormatted}</Text>
              )}
            </View>
            <Max
              onPress={() => {
                setValue(
                  'amount',
                  toAmountInputValue(isCollateral ? collateralAvailable : spendableAmount),
                );
                trigger('amount');
              }}
              disabled={isAvailableLoading || (isCollateral && collateralAvailable <= 0)}
            />
          </View>
        </View>
        <View
          className={cn(
            'w-full flex-row items-center justify-between gap-4 rounded-2xl bg-accent px-5 py-3',
            formState.errors.amount && 'border border-red-500',
          )}
        >
          <View className="flex-1 flex-row items-center gap-2">
            <Text className="text-2xl font-semibold text-foreground">$</Text>
            <Controller
              control={control}
              name="amount"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  keyboardType="decimal-pad"
                  className="min-w-0 flex-1 text-2xl font-semibold text-white web:focus:outline-none"
                  value={value}
                  placeholder="1.00"
                  placeholderTextColor="#666"
                  onChangeText={v => {
                    clearErrors('amount');
                    onChange(v);
                  }}
                  onBlur={onBlur}
                />
              )}
            />
          </View>
        </View>
      </View>

      {/* To - destination (Wallet) */}
      <View className="gap-2">
        <Text className="font-medium opacity-50">To</Text>
        <Controller
          control={control}
          name="to"
          render={({ field: { onChange } }) => (
            <ToDestinationSelector
              onChange={onChange}
              tokenSymbol={depositTokenSymbol}
              assets={collateral?.tokens}
              selectedTokenAddress={collateral?.tokenAddress}
              onSelectAsset={asset => {
                setSelectedTokenAddress(asset.tokenAddress);
                // The cap belongs to the old asset; clear it rather than
                // validate the typed amount against a balance it never had.
                setValue('amount', '');
                clearErrors('amount');
              }}
            />
          )}
        />
      </View>

      {(validationError ?? formState.errors.amount?.message) ? (
        <Text className="text-sm text-red-500">
          {validationError ?? formState.errors.amount?.message}
        </Text>
      ) : collateralShortfallHint ? (
        <Text className="text-sm opacity-50">{collateralShortfallHint}</Text>
      ) : null}

      <Button
        variant="brand"
        className="h-12 rounded-2xl"
        disabled={disabled}
        onPress={handleSubmit(onSubmit)}
      >
        {isSubmitting ? (
          <ActivityIndicator color="black" />
        ) : (
          <Text className="text-base font-bold text-black">Withdraw</Text>
        )}
      </Button>
    </View>
  );
}
