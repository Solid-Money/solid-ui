import { zodResolver } from "@hookform/resolvers/zod";
import { Image } from "expo-image";
import { Fuel } from "lucide-react-native";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from 'react-native-toast-message';
import { formatUnits } from "viem";
import { z } from "zod";

import { CheckConnectionWrapper } from "@/components/CheckConnectionWrapper";
import TokenCard from "@/components/TokenCard";
import TokenDetail from "@/components/TokenCard/TokenDetail";
import TokenDetails from "@/components/TokenCard/TokenDetails";
import TokenDivider from "@/components/TokenCard/TokenDivider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useTotalAPY } from "@/hooks/useAnalytics";
import useDeposit from "@/hooks/useDeposit";
import { useDimension } from "@/hooks/useDimension";
import { useEstimateGas } from "@/hooks/useEstimateGas";
import { Status } from "@/lib/types";
import { compactNumberFormat, formatNumber } from "@/lib/utils";
import { useRouter } from "expo-router";

export default function Deposit() {
  const router = useRouter();
  const { balance, deposit, depositStatus } = useDeposit();
  const isLoading = depositStatus === Status.PENDING;
  const { data: totalAPY } = useTotalAPY();
  const { isDesktop } = useDimension();
  const { costInUsd, loading } = useEstimateGas();

  const formattedBalance = balance ? formatUnits(balance, 6) : "0";

  // Create dynamic schema based on balance
  const depositSchema = useMemo(() => {
    const balanceAmount = balance ? Number(formatUnits(balance, 6)) : 0;

    return z.object({
      amount: z
        .string()
        .refine((val) => val !== "" && !isNaN(Number(val)), "Please enter a valid amount")
        .refine((val) => Number(val) > 0, "Amount must be greater than 0")
        .refine((val) => Number(val) <= balanceAmount, `Available balance is ${formatNumber(balanceAmount)} USDC`)
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
      amount: '',
    },
  });

  const watchedAmount = watch("amount");

  const getButtonText = () => {
    if (errors.amount) return errors.amount.message;
    if (depositStatus === Status.PENDING) return "Depositing";
    if (depositStatus === Status.ERROR) return "Error while depositing";
    if (depositStatus === Status.SUCCESS) return "Successfully deposited";
    if (!isValid || !watchedAmount) return "Enter an amount";
    return "Deposit";
  };

  const onSubmit = async (data: DepositFormData) => {
    try {
      await deposit(data.amount.toString());
      reset(); // Reset form after successful transaction
      router.back()
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error while depositing',
      });
    }
  };

  const isFormDisabled = () => {
    return (
      isLoading ||
      !isValid ||
      !watchedAmount
    );
  };

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={isDesktop ? [] : ['top', 'right', 'left', 'bottom']}
    >
      <ScrollView className="flex-1">
        <View className="w-full max-w-2xl mx-auto gap-12 md:gap-16 px-4 py-8 md:py-16">
          <View className="gap-4">
            <Text className="text-3xl font-semibold">
              Deposit to your saving account
            </Text>
            <Text className="text-xl opacity-50 max-w-md">
              Earn yield on your Earn yield on your Earn yield on your Earn yield
              on your Earn yield on your
            </Text>
          </View>
          <View className="gap-4">
            <View className="gap-1">
              <Controller
                control={control}
                name="amount"
                render={({ field: { onChange, value } }) => (
                  <TokenCard
                    amount={value.toString()}
                    onAmountChange={onChange}
                    balance={formattedBalance}
                    price={1}
                  />
                )}
              />
              <TokenDivider />
              <TokenDetails>
                <TokenDetail className="md:flex-row md:items-center gap-4 md:gap-10">
                  <Text className="text-lg opacity-40 md:w-40">
                    You will receive
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <Image
                      source={require("@/assets/images/usdc.png")}
                      style={{ width: 34, height: 34 }}
                      contentFit="contain"
                    />
                    <Text className="text-2xl font-semibold">
                      {compactNumberFormat(Number(watchedAmount))} soUSD
                    </Text>
                    {/* <Text className="text-lg opacity-40 text-right">
                    {`(${compactNumberFormat(costInUsd)} USDC in fee)`}
                  </Text> */}
                  </View>
                </TokenDetail>
                <TokenDetail className="md:flex-row md:items-center gap-4 md:gap-10">
                  <Text className="text-lg opacity-40 md:w-40">APY</Text>
                  <View className="flex-row items-baseline gap-2">
                    <Text className="text-2xl font-semibold">
                      {totalAPY ? (
                        `${totalAPY.toFixed(2)}%`
                      ) : (
                        <Skeleton className="w-20 h-8" />
                      )}
                    </Text>
                    <Text className="text-base opacity-40">
                      {totalAPY ? (
                        `Earn ~${compactNumberFormat(
                          Number(watchedAmount) * (totalAPY / 100)
                        )} USDC/year`
                      ) : (
                        <Skeleton className="w-20 h-6" />
                      )}
                    </Text>
                  </View>
                </TokenDetail>
              </TokenDetails>
            </View>
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1 pb-5 pt-2">
                  <Fuel size={18} />
                  <Text className="text-base text-white">Fee</Text>
                </View>
                <Text className="text-base text-muted-foreground">
                  {`~ $${loading ? "..." : formatNumber(costInUsd, 2)
                    } USDC in fee`}
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
                    {getButtonText()}
                  </Text>
                  {isLoading && (
                    <ActivityIndicator color="gray" />
                  )}
                </Button>
              </CheckConnectionWrapper>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
