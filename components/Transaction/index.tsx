import { Image } from "expo-image";
import { View } from "react-native";

import { LayerZeroTransactionStatus, TransactionType } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { Text } from "../ui/text";
import TransactionDropdown from "./TransactionDropdown";
import { useDimension } from "@/hooks/useDimension";

const Transaction = ({
  title,
  timestamp,
  amount,
  status,
  hash,
  type,
}: {
  title: string;
  timestamp: string;
  amount: number;
  status: LayerZeroTransactionStatus;
  hash?: string;
  type: TransactionType;
}) => {
  const { isScreenMedium } = useDimension();
  const isSuccess = status === LayerZeroTransactionStatus.DELIVERED;
  const isPending =
    status === LayerZeroTransactionStatus.INFLIGHT ||
    status === LayerZeroTransactionStatus.CONFIRMING;

  const statusBgColor = isSuccess
    ? "bg-brand/10"
    : isPending
      ? "bg-yellow-400/10"
      : "bg-red-400/10";
  const statusTextColor = isSuccess
    ? "text-brand"
    : isPending
      ? "text-yellow-400"
      : "text-red-400";
  const statusText = isSuccess ? "Success" : isPending ? "Pending" : "Failed";

  return (
    <View className="flex-row items-center justify-between bg-card p-4 md:px-6 rounded-twice">
      <View className="flex-row items-center gap-2 md:gap-4">
        <Image
          source={require("@/assets/images/usdc.png")}
          style={{ width: 34, height: 34 }}
        />
        <View>
          <Text className="text-lg font-medium">{title}</Text>
          <Text className="text-sm text-muted-foreground">
            {new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "numeric",
              hour12: true,
            })}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center gap-2 md:gap-4">
        <Text className="text-lg font-medium">${formatNumber(amount, 5)}</Text>
        {isScreenMedium && (
          <View
            className={cn(
              "w-20 h-8 rounded-twice items-center justify-center",
              statusBgColor
            )}
          >
            <Text className={cn("text-sm font-bold", statusTextColor)}>
              {statusText}
            </Text>
          </View>
        )}
        <TransactionDropdown hash={hash} type={type} />
      </View>
    </View>
  );
};

export default Transaction;
