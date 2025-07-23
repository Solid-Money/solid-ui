import { zodResolver } from "@hookform/resolvers/zod";
import { Image } from "expo-image";
import { Fuel, Wallet } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, TextInput, View } from "react-native";
import { formatUnits } from "viem";
import { useWaitForTransactionReceipt } from "wagmi";
import { z } from "zod";
import { mainnet } from "viem/chains";

import { Button } from "@/components/ui/button";
import { DEPOSIT_MODAL } from "@/constants/modals";
import { useTotalAPY } from "@/hooks/useAnalytics";
import useDepositFromEOA from "@/hooks/useDepositFromEOA";
import { useEstimateGas } from "@/hooks/useEstimateGas";
import { usePreviewDeposit } from "@/hooks/usePreviewDeposit";
import { Status } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { useDepositStore } from "@/store/useDepositStore";
import { CheckConnectionWrapper } from "../CheckConnectionWrapper";
import ConnectedWalletDropdown from "../ConnectedWalletDropdown";
import TokenDetails from "../TokenCard/TokenDetails";
import { Skeleton } from "../ui/skeleton";
import { Text } from "../ui/text";

function DepositToVaultForm() {
  const { balance, deposit, depositStatus, hash } = useDepositFromEOA();
  const { isLoading: isPending, isSuccess } = useWaitForTransactionReceipt({
    hash: hash as `0x${string}`,
    chainId: mainnet.id,
  });
  const { setModal, setTransaction } = useDepositStore();

  const isLoading = depositStatus === Status.PENDING || isPending;
  const { data: totalAPY } = useTotalAPY();
  const { costInUsd, loading } = useEstimateGas();

  const formattedBalance = balance ? formatUnits(balance, 6) : "0";

  // Create dynamic schema based on balance
  const depositSchema = useMemo(() => {
    const balanceAmount = balance ? Number(formatUnits(balance, 6)) : 0;

    return z.object({
      amount: z
        .string()
        .refine(
          (val) => val !== "" && !isNaN(Number(val)),
          "Please enter a valid amount"
        )
        .refine((val) => Number(val) > 0, "Amount must be greater than 0")
        .refine(
          (val) => Number(val) <= balanceAmount,
          `Available balance is ${formatNumber(balanceAmount, 4)} USDC`
        )
        .transform((val) => Number(val)),
    });
  }, [balance]);

  type DepositFormData = { amount: string };

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    reset,
  } = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema) as any,
    mode: "onChange",
    defaultValues: {
      amount: "",
    },
  });

  const watchedAmount = watch("amount");
  const { amountOut, isLoading: isPreviewDepositLoading } =
    usePreviewDeposit(watchedAmount);

  const getButtonText = () => {
    if (errors.amount) return errors.amount.message;
    if (!isValid || !watchedAmount) return "Enter an amount";
    if (depositStatus === Status.PENDING) return "Check Wallet";
    if (isPending) return "Depositing...";
    if (isSuccess) return "Successfully deposited!";
    if (depositStatus === Status.ERROR) return "Error while depositing";
    return "Deposit";
  };

  const onSubmit = async (data: DepositFormData) => {
    try {
      await deposit(data.amount.toString());
      setTransaction({
        amount: Number(data.amount),
        hash,
      });
    } catch (error) {
      // handled by hook
    }
  };

  useEffect(() => {
    if (isSuccess) {
      reset(); // Reset form after successful transaction
      setModal(DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS);
    }
  }, [isSuccess, reset, setModal]);

  const isFormDisabled = () => {
    return isLoading || !isValid || !watchedAmount;
  };

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-muted-foreground">From wallet</Text>
        <ConnectedWalletDropdown />
      </View>
      <View className="gap-2">
        <Text className="text-muted-foreground">Deposit amount</Text>
        <View className="px-5 py-4 bg-accent rounded-2xl flex-row items-center justify-between gap-2 w-full">
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
              style={{ width: 32, height: 32 }}
            />
            <Text className="font-semibold text-white text-lg">USDC</Text>
          </View>
        </View>
        <Text className="flex items-center gap-1.5 text-muted-foreground text-left">
          <Wallet size={16} /> {formatNumber(Number(formattedBalance), 6)} USDC
        </Text>
      </View>
      <TokenDetails>
        <View className="p-4 md:p-5 md:flex-row md:items-center gap-2 md:gap-10">
          <Text className="text-lg opacity-40 md:w-40">You will receive</Text>
          <View className="flex-row items-center gap-2">
            <Image
              source={require("@/assets/images/usdc.png")}
              style={{ width: 34, height: 34 }}
              contentFit="contain"
            />
            <View className="flex-row items-baseline gap-2">
              <Text className="text-2xl font-semibold">
                {isPreviewDepositLoading ? (
                  <Skeleton className="w-20 h-8" />
                ) : (
                  parseFloat(amountOut.toFixed(3)) || 0
                )}
              </Text>
              <Text>soUSD</Text>
            </View>
            {/* <Text className="text-lg opacity-40 text-right">
                      {`(${compactNumberFormat(costInUsd)} USDC in fee)`}
                    </Text> */}
          </View>
        </View>
        <View className="p-4 md:p-5 md:flex-row md:items-center gap-2 md:gap-10">
          <Text className="text-lg opacity-40 md:w-40">APY</Text>
          <View className="flex-row items-baseline gap-2">
            <Text className="text-2xl font-semibold text-[#94F27F]">
              {totalAPY ? (
                `${totalAPY.toFixed(2)}%`
              ) : (
                <Skeleton className="w-20 h-8" />
              )}
            </Text>
            {/* <Text className="text-base opacity-40">
                  {totalAPY ? (
                    `Earn ~${compactNumberFormat(
                      Number(watchedAmount) * (totalAPY / 100)
                    )} USDC/year`
                  ) : (
                    <Skeleton className="w-20 h-6" />
                  )}
                </Text> */}
          </View>
        </View>
      </TokenDetails>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1">
          <Fuel color="gray" size={18} />
          <Text className="text-base text-muted-foreground">Fee</Text>
        </View>
        <Text className="text-base text-muted-foreground">
          {`~ $${loading ? "..." : formatNumber(costInUsd, 2)} USDC in fee`}
        </Text>
      </View>
      <CheckConnectionWrapper props={{ size: "xl" }}>
        <Button
          variant="brand"
          className="rounded-2xl h-12"
          onPress={handleSubmit(onSubmit)}
          disabled={isFormDisabled()}
        >
          <Text className="text-lg font-semibold">
            {getButtonText()?.slice(0, 30)}
          </Text>
          {isLoading && <ActivityIndicator color="gray" />}
        </Button>
      </CheckConnectionWrapper>
    </View>
  );
}

export default DepositToVaultForm;
