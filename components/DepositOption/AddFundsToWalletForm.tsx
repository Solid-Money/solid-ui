import { useEffect, useMemo, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Wallet } from 'lucide-react-native';
import { Address, formatUnits } from 'viem';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import { CheckConnectionWrapper } from '@/components/CheckConnectionWrapper';
import ConnectedWalletDropdown from '@/components/ConnectedWalletDropdown';
import Max from '@/components/Max';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useTransferToWallet from '@/hooks/useTransferToWallet';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { Status } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';

function AddFundsToWalletForm() {
  const { setModal, setTransaction, srcChainId, outputToken } = useDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setTransaction: state.setTransaction,
      srcChainId: state.srcChainId,
      outputToken: state.outputToken,
    })),
  );
  const selectedTokenInfo = useMemo(() => {
    const tokens = BRIDGE_TOKENS[srcChainId]?.tokens;
    const tokenData = tokens ? tokens[outputToken as keyof typeof tokens] : undefined;

    return {
      address: tokenData?.address,
      name: tokenData?.name || outputToken,
      image: tokenData?.icon || getAsset('images/usdc.png'),
      fullName: tokenData?.fullName,
    };
  }, [srcChainId, outputToken]);

  const { balance, transfer, transferStatus, error } = useTransferToWallet(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
  );

  const isStablecoin = outputToken === 'USDC' || outputToken === 'USDT';
  const decimals = isStablecoin ? 6 : 18;
  const isLoading = transferStatus.status === Status.PENDING;

  const formattedBalance = balance ? formatUnits(balance, decimals) : '0';

  const transferSchema = useMemo(() => {
    const balanceAmount = balance ? Number(formatUnits(balance, decimals)) : 0;
    const tokenLabel = selectedTokenInfo?.name ?? 'token';

    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), {
          error: 'Please enter a valid amount',
        })
        .refine(val => Number(val) > 0, { error: 'Amount must be greater than 0' })
        .refine(val => Number(val) <= balanceAmount, {
          error: `Available balance is ${formatNumber(balanceAmount)} ${tokenLabel}`,
        }),
    });
  }, [balance, decimals, selectedTokenInfo?.name]);

  type TransferFormData = { amount: string };

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    reset,
    setValue,
    trigger,
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema) as any,
    mode: 'onChange',
    defaultValues: { amount: '' },
  });

  const watchedAmount = watch('amount');

  const hasTrackedFormView = useRef(false);
  useEffect(() => {
    if (!hasTrackedFormView.current) {
      track(TRACKING_EVENTS.DEPOSIT_WALLET_FORM_VIEWED, {
        deposit_method: 'wallet_transfer',
        chain_id: srcChainId,
        token: selectedTokenInfo.name,
        balance: formattedBalance,
      });
      hasTrackedFormView.current = true;
    }
  }, [srcChainId, selectedTokenInfo.name, formattedBalance]);

  const getButtonText = () => {
    if (errors.amount) return errors.amount.message;
    if (!isValid || !watchedAmount) return 'Enter an amount';
    if (transferStatus.status === Status.PENDING) return transferStatus.message;
    if (transferStatus.status === Status.SUCCESS) return 'Transfer successful!';
    if (transferStatus.status === Status.ERROR) return error || 'Transfer failed';
    return 'Transfer to Wallet';
  };

  const handleSuccess = () => {
    reset();
    setModal(DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS);
  };

  const onSubmit = async (data: TransferFormData) => {
    try {
      track(TRACKING_EVENTS.DEPOSIT_WALLET_FORM_SUBMITTED, {
        deposit_method: 'wallet_transfer',
        chain_id: srcChainId,
        token: selectedTokenInfo.name,
        amount: data.amount,
        balance: formattedBalance,
      });

      const trackingId = await transfer(data.amount);
      setTransaction({
        amount: Number(data.amount),
        trackingId,
      });
      handleSuccess();
    } catch (_error) {
      // handled by hook
    }
  };

  const isFormDisabled = () => {
    return isLoading || !isValid || !watchedAmount;
  };

  return (
    <Pressable onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-muted-foreground">From wallet</Text>
          <ConnectedWalletDropdown />
        </View>
        <View className="gap-2">
          <Text className="text-muted-foreground">Amount</Text>
          <View className="w-full flex-row items-center justify-between gap-2 rounded-2xl bg-accent px-5 py-4">
            <Controller
              control={control}
              name="amount"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  keyboardType="decimal-pad"
                  className="min-w-0 flex-1 text-2xl font-semibold text-white web:focus:outline-none"
                  value={value.toString()}
                  placeholder="0.0"
                  placeholderTextColor="#666"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  returnKeyType="done"
                  onSubmitEditing={Platform.OS === 'web' ? undefined : () => Keyboard.dismiss()}
                />
              )}
            />
            <View className="shrink-0 flex-row items-center gap-2">
              <Pressable
                onPress={() => setModal(DEPOSIT_MODAL.OPEN_TOKEN_SELECTOR)}
                className="flex-row items-center gap-2"
              >
                <Image
                  source={selectedTokenInfo.image}
                  alt={selectedTokenInfo.name}
                  style={{ width: 32, height: 32 }}
                />
                <Text className="text-lg font-semibold text-white">{selectedTokenInfo.name}</Text>
                <ChevronDown size={16} color="#A1A1A1" />
              </Pressable>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <Wallet color="#A1A1A1" size={16} />
            <Text className="text-muted-foreground">
              {formatNumber(Number(formattedBalance))} {selectedTokenInfo.name}
            </Text>
            <Max
              onPress={() => {
                setValue('amount', formattedBalance);
                trigger('amount');
              }}
            />
          </View>
        </View>

        <CheckConnectionWrapper props={{ size: 'xl' }}>
          <Button
            variant="brand"
            className="h-12 rounded-2xl"
            onPress={handleSubmit(onSubmit)}
            disabled={isFormDisabled()}
          >
            <Text className="text-base font-bold">{getButtonText()?.slice(0, 30)}</Text>
            {isLoading && <ActivityIndicator color="gray" />}
          </Button>
        </CheckConnectionWrapper>
      </View>
    </Pressable>
  );
}

export default AddFundsToWalletForm;
