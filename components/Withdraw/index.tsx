import { zodResolver } from "@hookform/resolvers/zod";
import { Address } from "abitype";
import { Info, Minus, Wallet } from "lucide-react-native";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Image, TextInput, View } from "react-native";
import Toast from 'react-native-toast-message';
import { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { WITHDRAW_MODAL } from "@/constants/modals";
import useUser from "@/hooks/useUser";
import { useEthereumVaultBalance } from "@/hooks/useVault";
import useWithdraw from "@/hooks/useWithdraw";
import getTokenIcon from "@/lib/getTokenIcon";
import { Status } from "@/lib/types";
import { cn, eclipseAddress, formatNumber } from "@/lib/utils";
import { useWithdrawStore } from "@/store/useWithdrawStore";
import { Skeleton } from "../ui/skeleton";
import Max from "../Max";

const Withdraw = () => {
  const { user } = useUser();
  const { setModal, setTransaction } = useWithdrawStore();

  const { data: ethereumBalance, isLoading: isEthereumBalanceLoading } =
    useEthereumVaultBalance(user?.safeAddress as Address);

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

  type WithdrawFormData = { amount: string; };

  const {
    control: withdrawControl,
    handleSubmit: handleWithdrawSubmit,
    formState: { errors: withdrawErrors, isValid: isWithdrawValid },
    watch: watchWithdraw,
    reset: resetWithdraw,
    setValue,
    trigger,
  } = useForm<WithdrawFormData>({
    resolver: zodResolver(withdrawSchema) as any,
    mode: "onChange",
    defaultValues: {
      amount: '',
    },
  });

  const watchedWithdrawAmount = watchWithdraw("amount");

  const { withdraw, withdrawStatus } = useWithdraw();
  const isWithdrawLoading = withdrawStatus === Status.PENDING;

  const getWithdrawText = () => {
    if (withdrawErrors.amount) return withdrawErrors.amount.message;
    if (withdrawStatus === Status.PENDING) return "Withdrawing";
    if (withdrawStatus === Status.ERROR) return "Error while Withdrawing";
    if (withdrawStatus === Status.SUCCESS) return "Withdrawal Successful";
    if (!isWithdrawValid || !watchedWithdrawAmount) return "Enter an amount";
    return "Withdraw";
  };

  const onWithdrawSubmit = async (data: WithdrawFormData) => {
    try {
      const transaction = await withdraw(data.amount.toString());
      setTransaction({
        amount: Number(data.amount),
        hash: transaction.transactionHash,
      });
      resetWithdraw(); // Reset form after successful transaction
      setModal(WITHDRAW_MODAL.OPEN_TRANSACTION_STATUS);
      Toast.show({
        type: 'success',
        text1: 'Withdrawal transaction completed',
        text2: `${data.amount} soUSD`,
        props: {
          link: `https://etherscan.io/tx/${transaction.transactionHash}`,
          linkText: eclipseAddress(transaction.transactionHash),
          image: getTokenIcon({ tokenSymbol: 'SoUSD' }),
        },
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error while withdrawing',
      });
    }
  };

  const isWithdrawFormDisabled = () => {
    return (
      isWithdrawLoading ||
      !isWithdrawValid ||
      !watchedWithdrawAmount
    );
  };

  return (
    <View className="gap-8">
      <View className="gap-3">
        <Text className="opacity-60">Withdraw amount</Text>

        <View className={cn('flex-row items-center justify-between gap-4 w-full bg-accent rounded-2xl px-5 py-3', withdrawErrors.amount && 'border border-red-500')}>
          <Controller
            control={withdrawControl}
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
              source={require("@/assets/images/sousd-4x.png")}
              alt="SoUSD"
              style={{ width: 34, height: 34 }}
            />
            <Text className="font-semibold text-white text-lg">SoUSD</Text>
          </View>
        </View>

        <Text className="flex items-center gap-1.5 text-muted-foreground text-left">
          <Wallet size={16} /> {isEthereumBalanceLoading ? (
            <Skeleton className="w-16 h-4 rounded-md" />
          ) : ethereumBalance ? (
            `${formatNumber(ethereumBalance, 4)} SoUSD`
          ) : (
            "0 SoUSD"
          )}
          <Max
            onPress={() => {
              setValue("amount", ethereumBalance?.toString() ?? "0");
              trigger("amount");
            }}
          />
        </Text>
      </View>

      <View className="flex-row gap-2">
        <Info size={30} color="gray" />
        <Text className="text-sm text-muted-foreground">
          This action will withdraw your funds and allow you to send them to another wallet
        </Text>
      </View>

      <Button
        variant="brand"
        className="rounded-2xl h-12 mt-32"
        onPress={handleWithdrawSubmit(onWithdrawSubmit)}
        disabled={isWithdrawFormDisabled()}
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
      className={buttonVariants({ variant: "secondary", className: "h-12 md:pr-6 rounded-xl" })}
      {...props}
    >
      <View className="flex-row items-center gap-4">
        <Minus color="white" />
        <Text className="hidden md:block font-bold">Withdraw</Text>
      </View>
    </Button>
  );
};

const WithdrawTitle = () => {
  return <Text className="text-2xl font-semibold">Withdraw from savings</Text>;
};

export { Withdraw, WithdrawTitle, WithdrawTrigger };
