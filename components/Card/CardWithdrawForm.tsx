import { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Linking, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { Wallet as WalletIcon } from 'lucide-react-native';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import Max from '@/components/Max';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD_WITHDRAW_MODAL } from '@/constants/modals';
import { useCardDetails } from '@/hooks/useCardDetails';
import useUser from '@/hooks/useUser';
import { withdrawFromCard } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import { cn, formatNumber } from '@/lib/utils';
import { useCardWithdrawStore } from '@/store/useCardWithdrawStore';

type FormData = { amount: string };

const DOLLAR_ICON = getAsset('images/usdc-4x.png');

export default function CardWithdrawForm() {
  const { user } = useUser();
  const { data: cardDetails, refetch } = useCardDetails();
  const { setModal, setTransaction } = useCardWithdrawStore(
    useShallow(state => ({ setModal: state.setModal, setTransaction: state.setTransaction })),
  );

  const spendableAmount = Number(cardDetails?.balances?.available?.amount ?? 0);
  const formattedBalance = spendableAmount.toString();

  const { control, handleSubmit, formState, watch, setValue, trigger } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: { amount: '' },
  });

  const watchedAmount = watch('amount');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        amount: z
          .string()
          .refine(val => val !== '' && !isNaN(Number(val)), { message: 'Enter a valid amount' })
          .refine(val => Number(val) >= 1, { message: 'Minimum withdrawal is $1' })
          .refine(val => Number(val) <= spendableAmount, {
            message: `Amount exceeds spendable balance (${formatNumber(spendableAmount)} available)`,
          }),
      }),
    [spendableAmount],
  );

  const isValid = useMemo(() => {
    try {
      schema.parse({ amount: watchedAmount });
      return true;
    } catch {
      return false;
    }
  }, [watchedAmount, schema]);

  const validationError = useMemo(() => {
    if (!watchedAmount) return null;
    try {
      schema.parse({ amount: watchedAmount });
      return null;
    } catch (error: unknown) {
      const err = error as { errors?: { message?: string }[] };
      return err.errors?.[0]?.message ?? null;
    }
  }, [watchedAmount, schema]);

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (!user?.safeAddress) {
        Toast.show({
          type: 'error',
          text1: 'Safe address not found',
          text2: 'Please try again',
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await withdrawFromCard({
          amount: data.amount,
          destination: {
            chain: 'ethereum',
            address: user.safeAddress,
          },
        });

        setTransaction({ amount: Number(data.amount) });
        setModal(CARD_WITHDRAW_MODAL.CLOSE);
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
      } catch (err: unknown) {
        let message = 'Withdrawal failed';
        if (err instanceof Response) {
          try {
            const body = await err.json();
            message = body?.message ?? err.statusText ?? message;
          } catch {
            message = err.statusText ?? message;
          }
        } else if (err instanceof Error) {
          message = err.message;
        }
        Toast.show({ type: 'error', text1: 'Withdrawal failed', text2: message });
      } finally {
        setIsSubmitting(false);
      }
    },
    [user?.safeAddress, setModal, setTransaction, refetch],
  );

  const disabled = !isValid || !watchedAmount || isSubmitting;

  return (
    <View className="flex-1 gap-3">
      {/* Amount */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium opacity-50">Amount</Text>

          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1">
              <WalletIcon color="#A1A1A1" size={16} />
              <Text className="font-medium opacity-50">${formattedBalance}</Text>
            </View>
            <Max
              onPress={() => {
                setValue('amount', formattedBalance);
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
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
          </View>
        </View>
      </View>

      {/* To - Wallet only */}
      <View className="gap-2">
        <Text className="font-medium opacity-50">To</Text>
        <View className="flex-row items-center justify-between rounded-2xl bg-accent p-4">
          <View className="flex-row items-center gap-2">
            <WalletIcon color="#A1A1A1" size={24} />
            <Text className="text-lg font-semibold">Wallet</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Image source={DOLLAR_ICON} alt="USDC" style={{ width: 34, height: 34 }} />
            <Text className="text-lg font-semibold text-white">USDC (Ethereum)</Text>
          </View>
        </View>
      </View>

      <View className="flex-1" />

      {validationError ? (
        <View className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <Text className="text-sm text-red-500">{validationError}</Text>
        </View>
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
