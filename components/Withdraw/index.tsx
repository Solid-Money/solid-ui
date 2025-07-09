import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Image, TextInput, View } from "react-native";
import Toast from 'react-native-toast-message';
import { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import useBridgeToMainnet from "@/hooks/useBridgeToMainnet";
import useUser from "@/hooks/useUser";
import { useEthereumVaultBalance, useFuseVaultBalance } from "@/hooks/useVault";
import useWithdraw from "@/hooks/useWithdraw";
import { Status } from "@/lib/types";
import { Address } from "abitype";
import { Skeleton } from "../ui/skeleton";

import { eclipseAddress, formatNumber } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react-native";

const Withdraw = () => {
  const { user } = useUser();

  const { data: fuseBalance, isLoading: isFuseBalanceLoading } =
    useFuseVaultBalance(user?.safeAddress as Address);

  const { data: ethereumBalance, isLoading: isEthereumBalanceLoading } =
    useEthereumVaultBalance(user?.safeAddress as Address);

  // Create dynamic schema for bridge form based on fuse balance
  const bridgeSchema = useMemo(() => {
    const balanceAmount = fuseBalance || 0;
    return z.object({
      amount: z
        .string()
        .refine((val) => val !== "" && !isNaN(Number(val)), "Please enter a valid amount")
        .refine((val) => Number(val) > 0, "Amount must be greater than 0")
        .refine((val) => Number(val) <= balanceAmount, `Available balance is ${formatNumber(balanceAmount, 4)} soUSD`)
        .transform((val) => Number(val)),
    });
  }, [fuseBalance]);

  // Create dynamic schema for withdraw form based on ethereum balance
  const withdrawSchema = useMemo(() => {
    const balanceAmount = ethereumBalance || 0;
    return z.object({
      amount: z
        .string()
        .refine((val) => val !== "" && !isNaN(Number(val)), "Please enter a valid amount")
        .refine((val) => Number(val) > 0, "Amount must be greater than 0")
        .refine((val) => Number(val) <= balanceAmount, `Available balance is ${formatNumber(balanceAmount, 4)} soUSD`)
        .transform((val) => Number(val)),
    });
  }, [ethereumBalance]);

  type BridgeFormData = { amount: string; };
  type WithdrawFormData = { amount: string; };

  // Bridge form setup
  const {
    control: bridgeControl,
    handleSubmit: handleBridgeSubmit,
    formState: { errors: bridgeErrors, isValid: isBridgeValid },
    watch: watchBridge,
    reset: resetBridge,
  } = useForm<BridgeFormData>({
    resolver: zodResolver(bridgeSchema) as any,
    mode: "onChange",
    defaultValues: {
      amount: '',
    },
  });

  // Withdraw form setup
  const {
    control: withdrawControl,
    handleSubmit: handleWithdrawSubmit,
    formState: { errors: withdrawErrors, isValid: isWithdrawValid },
    watch: watchWithdraw,
    reset: resetWithdraw,
  } = useForm<WithdrawFormData>({
    resolver: zodResolver(withdrawSchema) as any,
    mode: "onChange",
    defaultValues: {
      amount: '',
    },
  });

  const watchedBridgeAmount = watchBridge("amount");
  const watchedWithdrawAmount = watchWithdraw("amount");

  const { bridge, bridgeStatus } = useBridgeToMainnet();
  const isBridgeLoading = bridgeStatus === Status.PENDING;

  const { withdraw, withdrawStatus } = useWithdraw();
  const isWithdrawLoading = withdrawStatus === Status.PENDING;

  const getBridgeText = () => {
    if (bridgeErrors.amount) return bridgeErrors.amount.message;
    if (bridgeStatus === Status.PENDING) return "Bridging";
    if (bridgeStatus === Status.ERROR) return "Error while bridging";
    if (bridgeStatus === Status.SUCCESS) return "Successfully Bridged";
    if (!isBridgeValid || !watchedBridgeAmount) return "Enter an amount";
    return "Bridge to Ethereum";
  };

  const getWithdrawText = () => {
    if (withdrawErrors.amount) return withdrawErrors.amount.message;
    if (withdrawStatus === Status.PENDING) return "Withdrawing";
    if (withdrawStatus === Status.ERROR) return "Error while Withdrawing";
    if (withdrawStatus === Status.SUCCESS) return "Withdrawal Successful";
    if (!isWithdrawValid || !watchedWithdrawAmount) return "Enter an amount";
    return "Withdraw";
  };

  const onBridgeSubmit = async (data: BridgeFormData) => {
    try {
      const transaction = await bridge(data.amount.toString());
      resetBridge(); // Reset form after successful transaction
      Toast.show({
        type: 'success',
        text1: 'Bridge transaction submitted',
        text2: `${data.amount} soUSD`,
        props: {
          link: `https://layerzeroscan.com/tx/${transaction.transactionHash}`,
          linkText: eclipseAddress(transaction.transactionHash),
          image: require("@/assets/images/usdc.png"),
        },
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error while bridging',
      });
    }
  };

  const onWithdrawSubmit = async (data: WithdrawFormData) => {
    try {
      const transaction = await withdraw(data.amount.toString());
      resetWithdraw(); // Reset form after successful transaction
      Toast.show({
        type: 'success',
        text1: 'Withdrawal transaction completed',
        text2: `${data.amount} soUSD`,
        props: {
          link: `https://etherscan.io/tx/${transaction.transactionHash}`,
          linkText: eclipseAddress(transaction.transactionHash),
          image: require("@/assets/images/usdc.png"),
        },
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error while withdrawing',
      });
    }
  };

  const isBridgeFormDisabled = () => {
    return (
      isBridgeLoading ||
      !isBridgeValid ||
      !watchedBridgeAmount
    );
  };

  const isWithdrawFormDisabled = () => {
    return (
      isWithdrawLoading ||
      !isWithdrawValid ||
      !watchedWithdrawAmount
    );
  };

  return (
    <View className="flex-col gap-4 min-h-64 md:min-h-72">
      <View className="flex-row justify-between items-center">
        <Text className="opacity-40">Fuse Balance</Text>
        <Text className="opacity-40">
          Balance:{" "}
          {isFuseBalanceLoading ? (
            <Skeleton className="w-20 h-8 rounded-md" />
          ) : fuseBalance ? (
            `${formatNumber(fuseBalance, 4)}`
          ) : (
            "0"
          )}
        </Text>
      </View>
      <View className={`bg-primary/10 rounded-2xl p-4 ${bridgeErrors.amount ? 'border border-red-500' : ''}`}>
        <View className="flex-row justify-between items-center gap-2">
          <Controller
            control={bridgeControl}
            name="amount"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                keyboardType="decimal-pad"
                className="w-full text-2xl md:text-3xl text-primary font-semibold web:focus:outline-none"
                value={value.toString()}
                placeholder="0.0"
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
            <View className="flex-col items-start">
              <Text className="font-bold">soUSD</Text>
              <Text className="text-xs opacity-40">On Fuse</Text>
            </View>
          </View>
        </View>
        <Button
          variant="brand"
          className="w-full rounded-xl mt-4"
          onPress={handleBridgeSubmit(onBridgeSubmit)}
          disabled={isBridgeFormDisabled()}
        >
          <Text className="font-bold">{getBridgeText()}</Text>
          {isBridgeLoading && <ActivityIndicator color="gray" />}
        </Button>
      </View>

      <View className="mt-5 flex-row justify-between items-center">
        <Text className="opacity-40">Ethereum Balance</Text>
        <Text className="opacity-40">
          Balance:{" "}
          {isEthereumBalanceLoading ? (
            <Skeleton className="w-20 h-8 rounded-md" />
          ) : ethereumBalance ? (
            `${formatNumber(ethereumBalance, 4)}`
          ) : (
            "0"
          )}
        </Text>
      </View>
      <View className={`bg-primary/10 rounded-2xl p-4 ${withdrawErrors.amount ? 'border border-red-500' : ''}`}>
        <View className="flex-row justify-between items-center gap-2">
          <Controller
            control={withdrawControl}
            name="amount"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                keyboardType="decimal-pad"
                className="w-full text-2xl md:text-3xl text-primary font-semibold web:focus:outline-none"
                value={value.toString()}
                placeholder="0.0"
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
            <View className="flex-col items-start">
              <Text className="font-bold">soUSD</Text>
              <Text className="text-xs opacity-40">On Ethereum</Text>
            </View>
          </View>
        </View>
        <Button
          variant="brand"
          className="w-full rounded-xl mt-4"
          onPress={handleWithdrawSubmit(onWithdrawSubmit)}
          disabled={isWithdrawFormDisabled()}
        >
          <Text className="font-bold">{getWithdrawText()}</Text>
          {isWithdrawLoading && <ActivityIndicator color="gray" />}
        </Button>
      </View>
    </View>
  );
};

const WithdrawTrigger = (props: any) => {
  return (
    <Button
      variant="outline"
      className={buttonVariants({ variant: "secondary", className: "h-12 pr-6 rounded-xl" })}
      {...props}
    >
      <View className="flex-row items-center gap-4">
        <ArrowUpRight color="white" />
        <Text className="font-bold">Withdraw</Text>
      </View>
    </Button>
  );
};

const WithdrawTitle = () => {
  return <Text className="text-lg font-semibold">Withdraw</Text>;
};

export { Withdraw, WithdrawTitle, WithdrawTrigger };
