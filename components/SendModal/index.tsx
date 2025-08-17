import { zodResolver } from '@hookform/resolvers/zod';
import { Address } from 'abitype';
import { ArrowUpRight, Fuel, Wallet } from 'lucide-react-native';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { formatUnits, isAddress } from 'viem';
import { useReadContract } from 'wagmi';
import { z } from 'zod';

import Max from '@/components/Max';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { NATIVE_TOKENS } from '@/constants/tokens';
import { useEstimateGas } from '@/hooks/useEstimateGas';
import useSend from '@/hooks/useSend';
import useUser from '@/hooks/useUser';
import ERC20_ABI from '@/lib/abis/ERC20';
import { Status, TokenIcon } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { getChain } from '@/lib/wagmi';
import { useSendStore } from '@/store/useSendStore';

type SendProps = {
  tokenAddress: Address;
  tokenDecimals: number;
  tokenIcon: TokenIcon;
  tokenSymbol: string;
  chainId: number;
};

const Send = ({ tokenAddress, tokenDecimals, tokenIcon, tokenSymbol, chainId }: SendProps) => {
  const { user } = useUser();
  const { costInUsd, loading } = useEstimateGas(1200000n, 0n, chainId, NATIVE_TOKENS[chainId]);
  const chain = getChain(chainId);
  const { setModal, setTransaction } = useSendStore();

  const { data: balance, isPending } = useReadContract({
    abi: ERC20_ABI,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [user?.safeAddress as Address],
    chainId: chainId,
    query: {
      enabled: !!user?.safeAddress,
    },
  });

  // Create dynamic schema based on balance
  const sendSchema = useMemo(() => {
    const balanceAmount = balance ? Number(formatUnits(balance, tokenDecimals)) : 0;
    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), 'Please enter a valid amount')
        .refine(val => Number(val) > 0, 'Amount must be greater than 0')
        .refine(
          val => Number(val) <= balanceAmount,
          `Available balance is ${formatNumber(balanceAmount)} ${tokenSymbol}`,
        )
        .transform(val => Number(val)),
      address: z
        .string()
        .refine(isAddress, 'Please enter a valid Ethereum address')
        .transform(value => value.toLowerCase()),
    });
  }, [balance, tokenDecimals, tokenSymbol]);

  type SendFormData = { amount: string; address: string };

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    setValue,
    trigger,
  } = useForm<SendFormData>({
    resolver: zodResolver(sendSchema) as any,
    mode: 'onChange',
    defaultValues: {
      amount: '',
      address: '',
    },
  });

  const { send, sendStatus } = useSend({ tokenAddress, tokenDecimals, chainId });
  const isSendLoading = sendStatus === Status.PENDING;

  const getSendText = () => {
    if (errors.amount) return errors.amount.message;
    if (errors.address) return errors.address.message;
    if (sendStatus === Status.PENDING) return 'Sending';
    if (sendStatus === Status.ERROR) return 'Error while Sending';
    if (sendStatus === Status.SUCCESS) return 'Successfully sent!';
    if (!isValid) return 'Please complete the form';
    return 'Send';
  };

  const onSubmit = async (data: SendFormData) => {
    try {
      const transaction = await send(data.amount.toString(), data.address as Address);
      setTransaction({
        amount: Number(data.amount),
        address: data.address,
      });
      reset(); // Reset form after successful transaction
      setModal(SEND_MODAL.OPEN_TRANSACTION_STATUS);
      Toast.show({
        type: 'success',
        text1: 'Send transaction completed',
        text2: `${data.amount} ${tokenSymbol}`,
        props: {
          link: `${chain?.blockExplorers?.default.url}/tx/${transaction.transactionHash}`,
          linkText: eclipseAddress(transaction.transactionHash),
          image: tokenIcon,
        },
      });
    } catch (_error) {
      Toast.show({
        type: 'error',
        text1: 'Error while sending',
      });
    }
  };

  const isFormDisabled = () => {
    return isSendLoading || !isValid;
  };

  return (
    <View className="gap-8">
      <View className="gap-3">
        <Text className="opacity-60">Send amount</Text>

        <View
          className={cn(
            'flex-row items-center justify-between gap-4 w-full bg-accent rounded-2xl px-5 py-3',
            errors.amount && 'border border-red-500',
          )}
        >
          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                keyboardType="decimal-pad"
                className="w-full text-2xl text-white font-semibold web:focus:outline-none"
                value={value.toString()}
                placeholder="0.0"
                placeholderTextColor="#666"
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
          <View className="flex-row items-center gap-2">
            <RenderTokenIcon tokenIcon={tokenIcon} size={34} />
            <Text className="font-semibold text-white text-lg">{tokenSymbol}</Text>
          </View>
        </View>

        <Text className="flex items-center gap-1.5 text-muted-foreground text-left">
          <Wallet size={16} />{' '}
          {isPending ? (
            <Skeleton className="w-16 h-4 rounded-md" />
          ) : balance ? (
            `${formatUnits(balance, tokenDecimals)} ${tokenSymbol}`
          ) : (
            `0 ${tokenSymbol}`
          )}
          <Max
            onPress={() => {
              setValue('amount', formatUnits(balance ?? 0n, tokenDecimals));
              trigger('amount');
            }}
          />
        </Text>
      </View>

      <View className="gap-3">
        <Text className="opacity-60">To wallet</Text>
        <Controller
          control={control}
          name="address"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className={`bg-accent rounded-2xl px-5 py-3 text-2xl text-white font-semibold web:focus:outline-none ${errors.address ? 'border border-red-500' : ''}`}
              value={value}
              placeholder="0x..."
              placeholderTextColor="#666"
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1">
          <Fuel color="gray" size={18} />
          <Text className="text-base text-muted-foreground">Fee</Text>
        </View>
        <Text className="text-base text-muted-foreground">
          {`~ $${
            loading
              ? '...'
              : !costInUsd
                ? '0'
                : costInUsd < 0.01
                  ? '<0.01'
                  : formatNumber(costInUsd, 2)
          } USD in fee`}
        </Text>
      </View>

      <Button
        variant="brand"
        className="rounded-2xl h-12 mt-24"
        onPress={handleSubmit(onSubmit)}
        disabled={isFormDisabled()}
      >
        <Text className="font-semibold text-black text-lg">{getSendText()}</Text>
        {isSendLoading && <ActivityIndicator color="black" />}
      </Button>
    </View>
  );
};

const SendTrigger = (props: any) => {
  return (
    <Button
      variant="outline"
      className={buttonVariants({
        variant: 'secondary',
        className: 'border-0 md:border md:h-12 rounded-xl gap-4 md:pr-6',
      })}
      {...props}
    >
      <ArrowUpRight color="white" />
      <Text className="hidden md:block font-bold">Send</Text>
    </Button>
  );
};

const SendTitle = () => {
  return <Text className="text-2xl font-semibold">Send</Text>;
};

export { Send, SendTitle, SendTrigger };
