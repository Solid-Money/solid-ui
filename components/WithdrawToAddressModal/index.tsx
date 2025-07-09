import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Image, TextInput, View } from "react-native";
import Toast from 'react-native-toast-message';
import { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import useUser from "@/hooks/useUser";
import ERC20_ABI from "@/lib/abis/ERC20";
import { Status } from "@/lib/types";
import { Address } from "abitype";
import { Skeleton } from "../ui/skeleton";

import useWithdrawToAddress from "@/hooks/useWithdrawToAddress";
import { ADDRESSES } from "@/lib/config";
import { cn, eclipseAddress, formatNumber } from "@/lib/utils";
import { useRouter } from "expo-router";
import { ArrowUpRight, Wallet } from "lucide-react-native";
import { useMemo } from "react";
import { formatUnits, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { useReadContract } from "wagmi";

const WithdrawToAddress = () => {
  const router = useRouter();
  const { user } = useUser();

  const { data: balance, isPending } = useReadContract({
    abi: ERC20_ABI,
    address: ADDRESSES.ethereum.usdc,
    functionName: "balanceOf",
    args: [user?.safeAddress as Address],
    chainId: mainnet.id,
    query: {
      enabled: !!user?.safeAddress,
    },
  });

  // Create dynamic schema based on balance
  const withdrawSchema = useMemo(() => {
    const balanceAmount = balance ? Number(formatUnits(balance, 6)) : 0;
    return z.object({
      amount: z
        .string()
        .refine((val) => val !== "" && !isNaN(Number(val)), "Please enter a valid amount")
        .refine((val) => Number(val) > 0, "Amount must be greater than 0")
        .refine((val) => Number(val) <= balanceAmount, `Available balance is ${formatNumber(balanceAmount, 4)} USDC`)
        .transform((val) => Number(val)),
      address: z
        .string()
        .refine(isAddress, "Please enter a valid Ethereum address")
        .transform(value => value.toLowerCase()),
    });
  }, [balance]);

  type WithdrawFormData = { amount: string; address: string };

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    reset,
  } = useForm<WithdrawFormData>({
    resolver: zodResolver(withdrawSchema) as any,
    mode: "onChange",
    defaultValues: {
      amount: "",
      address: "",
    },
  });

  const watchedAmount = watch("amount");

  const { withdrawToAddress, withdrawStatus } = useWithdrawToAddress();
  const isWithdrawLoading = withdrawStatus === Status.PENDING;

  const getWithdrawText = () => {
    if (errors.amount) return errors.amount.message;
    if (errors.address) return errors.address.message;
    if (withdrawStatus === Status.PENDING) return "Withdrawing";
    if (withdrawStatus === Status.ERROR) return "Error while Withdrawing";
    if (withdrawStatus === Status.SUCCESS) return "Withdrawal Successful";
    if (!isValid) return "Please complete the form";
    return "Withdraw";
  };

  const onSubmit = async (data: WithdrawFormData) => {
    try {
      const transaction = await withdrawToAddress(data.amount.toString(), data.address as Address);
      reset(); // Reset form after successful transaction
      Toast.show({
        type: 'success',
        text1: 'Send transaction completed',
        text2: `${data.amount} USDC`,
        props: {
          link: `https://etherscan.io/tx/${transaction.transactionHash}`,
          linkText: eclipseAddress(transaction.transactionHash),
          image: require("@/assets/images/usdc.png"),
        },
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error while sending',
      });
    }
  };

  const isFormDisabled = () => {
    return (
      isWithdrawLoading ||
      !isValid
    );
  };

  return (
    <View className="gap-8">
      <View className="gap-3">
        <Text className="opacity-60">Withdraw amount</Text>

        <View className={cn('flex-row items-center justify-between gap-4 w-full bg-accent rounded-2xl px-5 py-3', errors.amount && 'border border-red-500')}>
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
            <Image
              source={require("@/assets/images/usdc.png")}
              alt="USDC"
              style={{ width: 34, height: 34 }}
            />
            <Text className="font-semibold text-white text-lg">USDC</Text>
          </View>
        </View>

        <Text className="flex items-center gap-1.5 text-muted-foreground text-left">
          <Wallet size={16} /> {isPending ? (
            <Skeleton className="w-16 h-4 rounded-md" />
          ) : balance ? (
            `${formatUnits(balance, 6)} USDC`
          ) : (
            "0 USDC"
          )}
        </Text>
      </View>

      {/* {errors.amount && (
        <Text className="text-red-400 text-sm mt-1">{errors.amount.message}</Text>
      )} */}

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
        {/* {errors.address && (
          <Text className="text-red-400 text-sm mt-2">{errors.address.message}</Text>
        )} */}
      </View>

      <Button
        variant="brand"
        className="rounded-2xl h-12 mt-24"
        onPress={handleSubmit(onSubmit)}
        disabled={isFormDisabled()}
      >
        <Text className="font-semibold text-black text-lg">{getWithdrawText()}</Text>
        {isWithdrawLoading && <ActivityIndicator color="black" />}
      </Button>
    </View>
  );
};

const WithdrawTrigger = (props: any) => {
  return (
    <Button
      variant="outline"
      className={buttonVariants({ variant: "secondary", className: "h-12 rounded-xl gap-4 pr-6" })}
      {...props}
    >
      {/* <WithdrawIcon className="size-6" /> */}
      <ArrowUpRight color="white" />
      <Text className="font-bold">Send</Text>
    </Button>
  );
};

const WithdrawTitle = () => {
  return <Text className="text-2xl font-semibold">Send</Text>;
};

export { WithdrawTitle, WithdrawToAddress, WithdrawTrigger };

