import { LinearGradient } from 'expo-linear-gradient';
import { Leaf } from "lucide-react-native";
import { useCallback, useEffect, useState } from 'react';
import { View } from "react-native";

import { cn, formatNumber } from "@/lib/utils";
import { Text } from "../ui/text";

type SavingCardProps = {
  balance: number;
  apy: number;
  lastTimestamp: number;
  className?: string;
}

const SECONDS_PER_YEAR = 31_557_600;

const SavingCard = ({ balance, apy, lastTimestamp, className }: SavingCardProps) => {
  const [liveYield, setLiveYield] = useState<number>(0);

  const calculateLiveYield = useCallback((currentTime: number) => {
    const deltaTime = currentTime - lastTimestamp;
    const yieldEarned = balance * (apy / SECONDS_PER_YEAR) * deltaTime;
    const totalBalance = balance + yieldEarned;
    return totalBalance;
  }, [balance, apy, lastTimestamp]);

  useEffect(() => {
    const updateYield = () => {
      const now = Math.floor(Date.now() / 1000);
      setLiveYield(calculateLiveYield(now));
    };

    updateYield();

    const interval = setInterval(updateYield, 1000);
    return () => clearInterval(interval);
  }, [balance, apy, lastTimestamp, calculateLiveYield]);

  return (
    <LinearGradient
      colors={['rgba(100, 253, 65, 0.2)', 'rgba(61, 221, 26, 0.1)']}
      className={cn("bg-card rounded-twice p-6 justify-between w-full h-full", className)}
    >
      <View className="flex-row items-center gap-2 opacity-50">
        <Leaf size={18} />
        <Text className="text-lg font-semibold">Savings</Text>
      </View>

      <View className="flex-row justify-between items-center">
        <Text className="text-3xl text-brand font-semibold">${formatNumber(liveYield)}</Text>
        {/* <Image source={require('@/assets/images/bitcoin-usdc-4x.png')} style={{ width: 53, height: 28 }} /> */}
      </View>
    </LinearGradient>
  )
}

export default SavingCard;
