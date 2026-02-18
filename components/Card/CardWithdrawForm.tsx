import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Linking, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Wallet as WalletIcon } from 'lucide-react-native';
import { isAddress } from 'viem';
import { arbitrum } from 'viem/chains';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import ToDestinationSelector from '@/components/Card/ToDestinationSelector';
import Max from '@/components/Max';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD_WITHDRAW_MODAL } from '@/constants/modals';
import { useCardContracts } from '@/hooks/useCardContracts';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardProvider } from '@/hooks/useCardProvider';
import useUser from '@/hooks/useUser';
import { withdrawCardCollateral, withdrawFromCard, withdrawFromCardToSavings } from '@/lib/api';
import { CardProvider } from '@/lib/types';
import { cn, formatNumber } from '@/lib/utils';
import { CardDepositSource } from '@/store/useCardDepositStore';
import { useCardWithdrawStore } from '@/store/useCardWithdrawStore';

const USDC_DECIMALS = 6;

type FormData = { amount: string; to: CardDepositSource; recipientAddress?: string };

function getExplorerTxUrl(chainId: number | undefined, txHash: string): string {
  const base = chainId === arbitrum.id ? 'https://arbiscan.io' : 'https://etherscan.io';
  return `${base}/tx/${txHash}`;
}

export default function CardWithdrawForm() {
  const { user } = useUser();
  const { provider } = useCardProvider();
  const { data: cardDetails, refetch } = useCardDetails();
  const { data: contracts } = useCardContracts();
  const { setModal, setTransaction } = useCardWithdrawStore(
    useShallow(state => ({ setModal: state.setModal, setTransaction: state.setTransaction })),
  );

  const spendableAmount = Number(cardDetails?.balances?.available?.amount ?? 0);
  const formattedBalance = formatNumber(spendableAmount, 2, 2);

  const firstContract = contracts?.[0];
  const collateralBalanceRaw = firstContract?.tokens?.[0]?.balance;
  const collateralBalanceSmallestUnits = collateralBalanceRaw ? BigInt(collateralBalanceRaw) : 0n;
  const collateralAvailable = Number(collateralBalanceSmallestUnits) / 10 ** USDC_DECIMALS;
  const collateralFormatted =
    collateralBalanceRaw != null ? formatNumber(collateralAvailable, 2, 2) : '—';

  const { control, handleSubmit, formState, watch, setValue, setError, clearErrors, trigger } =
    useForm<FormData>({
      mode: 'onChange',
      defaultValues: {
        amount: '',
        to: CardDepositSource.SAVINGS,
        recipientAddress: '',
      },
    });

  const watchedAmount = watch('amount');
  const watchedTo = watch('to');
  const watchedRecipient = watch('recipientAddress');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCollateral = watchedTo === CardDepositSource.COLLATERAL;
  const showCollateralOption = provider === CardProvider.RAIN;

  useEffect(() => {
    if (isCollateral && user?.safeAddress) {
      setValue('recipientAddress', user.safeAddress);
    }
  }, [isCollateral, user?.safeAddress, setValue]);

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
          .refine(val => collateralBalanceRaw == null || Number(val) <= collateralAvailable, {
            message: `Amount exceeds available (${collateralFormatted} available)`,
          }),
        recipientAddress: z
          .string()
          .min(1, 'Recipient address is required')
          .refine(addr => isAddress(addr.trim()), 'Enter a valid Ethereum address'),
      }),
    [collateralBalanceRaw, collateralAvailable, collateralFormatted],
  );

  const validationError = useMemo(() => {
    if (isCollateral) {
      if (!watchedAmount && !watchedRecipient) return null;
      const parsed = collateralSchema.safeParse({
        amount: watchedAmount,
        recipientAddress: watchedRecipient ?? '',
      });
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
  }, [watchedAmount, watchedRecipient, isCollateral, schema, collateralSchema]);

  const onSubmit = useCallback(
    async (data: FormData) => {
      const toSavings = data.to === CardDepositSource.SAVINGS;
      const toCollateral = data.to === CardDepositSource.COLLATERAL;

      if (toCollateral) {
        const parsed = collateralSchema.safeParse({
          amount: data.amount,
          recipientAddress: (data.recipientAddress ?? '').trim(),
        });
        if (!parsed.success) {
          const msg = parsed.error.issues[0]?.message ?? 'Invalid input';
          setError('amount', { message: msg });
          if (parsed.error.issues[0]?.path?.includes('recipientAddress')) {
            setError('recipientAddress', { message: msg });
          }
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
          const recipientAddress = (data.recipientAddress ?? '').trim();
          const amountInSmallestUnits = Math.round(
            parseFloat(data.amount) * 10 ** USDC_DECIMALS,
          ).toString();
          const res = await withdrawCardCollateral({
            amount: amountInSmallestUnits,
            recipientAddress,
            ...(firstContract?.chainId != null && { chainId: firstContract.chainId }),
          });
          setTransaction({
            amount: Number(data.amount),
            clientTxId: res.transactionHash,
            to: data.to,
            transactionHash: res.transactionHash,
            chainId: firstContract?.chainId,
          });
          setModal(CARD_WITHDRAW_MODAL.OPEN_TRANSACTION_STATUS);
          await refetch();
          const explorerUrl = getExplorerTxUrl(firstContract?.chainId, res.transactionHash);
          Toast.show({
            type: 'success',
            text1: 'Withdrawal started',
            text2: `$${data.amount} collateral withdrawal.`,
            onPress: () => Linking.openURL(explorerUrl),
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
      schema,
      collateralSchema,
      setError,
      firstContract?.chainId,
    ],
  );

  const disabled = isSubmitting;
  const availableFormatted = isCollateral ? collateralFormatted : formattedBalance;

  return (
    <View className="flex-1 gap-3">
      {/* Amount */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium opacity-50">Amount</Text>

          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1">
              <WalletIcon color="#A1A1A1" size={16} />
              <Text className="font-medium opacity-50">${availableFormatted}</Text>
            </View>
            <Max
              onPress={() => {
                const value = isCollateral
                  ? collateralBalanceRaw != null
                    ? collateralFormatted
                    : '0'
                  : formattedBalance;
                setValue('amount', value);
                trigger('amount');
              }}
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

      {/* To - destination dropdown */}
      <View className="gap-2">
        <Text className="font-medium opacity-50">To</Text>
        <Controller
          control={control}
          name="to"
          render={({ field: { onChange, value } }) => (
            <ToDestinationSelector
              value={value}
              onChange={onChange}
              showCollateralOption={showCollateralOption}
            />
          )}
        />
      </View>

      {isCollateral && (
        <View className="gap-2">
          <Text className="font-medium opacity-50">Recipient address</Text>
          <Controller
            control={control}
            name="recipientAddress"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className={cn(
                  'w-full rounded-2xl bg-accent px-5 py-3 text-base text-foreground',
                  formState.errors.recipientAddress && 'border border-red-500',
                )}
                value={value ?? ''}
                placeholder="0x..."
                placeholderTextColor="#666"
                onChangeText={v => {
                  clearErrors('recipientAddress');
                  onChange(v);
                }}
                onBlur={onBlur}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
          />
        </View>
      )}

      <View className="flex-1">
        {(validationError ??
        formState.errors.amount?.message ??
        formState.errors.recipientAddress?.message) ? (
          <Text className="text-sm text-red-500">
            {validationError ??
              formState.errors.amount?.message ??
              formState.errors.recipientAddress?.message}
          </Text>
        ) : null}
      </View>

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
