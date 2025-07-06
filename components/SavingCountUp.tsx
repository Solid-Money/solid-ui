import {useCallback, useEffect, useState} from "react";
import {TextStyle, View} from "react-native";
import {AnimatedRollingNumber} from "react-native-animated-rolling-numbers";

import {Text} from "@/components/ui/text";
import {cn} from "@/lib/utils";

type ClassNames = {
  wrapper?: string;
  decimalSeparator?: string;
};

type Styles = {
  wholeText?: TextStyle;
  decimalText?: TextStyle;
};

interface SavingCountUpProps {
  balance: number;
  apy: number;
  lastTimestamp: number;
  principal?: number;
  mode?: "total" | "interest-only";
  decimalPlaces?: number;
  classNames?: ClassNames;
  styles?: Styles;
}

const SECONDS_PER_YEAR = 31_557_600;
const DURATION = 500;

const SavingCountUp = ({
  balance,
  apy,
  lastTimestamp,
  principal,
  mode = "total",
  decimalPlaces = 2,
  classNames,
  styles,
}: SavingCountUpProps) => {
  const [liveYield, setLiveYield] = useState<number>(0);

  const calculateLiveYield = useCallback(
    (currentTime: number) => {
      if (
        !currentTime ||
        currentTime <= 0 ||
        !lastTimestamp ||
        lastTimestamp <= 0
      ) {
        return mode === "interest-only" ? 0 : balance;
      }

      const deltaTime = Math.max(0, currentTime - lastTimestamp);

      if (deltaTime === 0) {
        return mode === "interest-only" ? 0 : balance;
      }

      const validAPY = isNaN(apy) || !isFinite(apy) ? 0 : Math.max(0, apy);

      if (principal !== undefined && principal > 0) {
        const timeInYears = deltaTime / SECONDS_PER_YEAR;
        const compoundedValue =
          principal * Math.pow(1 + validAPY / 100, timeInYears);

        if (!isFinite(compoundedValue) || compoundedValue < 0) {
          return mode === "interest-only" ? 0 : balance;
        }

        if (mode === "interest-only") {
          return Math.max(0, compoundedValue - principal);
        } else {
          return compoundedValue;
        }
      }

      if (mode === "interest-only") {
        const timeInYears = deltaTime / SECONDS_PER_YEAR;
        const estimatedInterest = balance * (validAPY / 100) * timeInYears;
        return Math.max(0, estimatedInterest);
      }

      const yieldEarned = balance * (validAPY / SECONDS_PER_YEAR) * deltaTime;
      const result = balance + yieldEarned;

      return isFinite(result) && result >= 0 ? result : balance;
    },
    [balance, apy, lastTimestamp, principal, mode]
  );

  useEffect(() => {
    const updateYield = () => {
      const now = Math.floor(Date.now() / 1000);
      setLiveYield(calculateLiveYield(now));
    };

    updateYield();

    const interval = setInterval(updateYield, 1000);
    return () => clearInterval(interval);
  }, [balance, apy, lastTimestamp, principal, mode, calculateLiveYield]);

  const safeYield = isFinite(liveYield) && liveYield >= 0 ? liveYield : 0;
  const wholeNumber = Math.floor(safeYield);
  const decimalString = safeYield.toFixed(decimalPlaces);
  const decimalPart = Number(decimalString.split(".")[1] || "0");

  return (
    <View className={cn("flex-row items-baseline", classNames?.wrapper)}>
      <AnimatedRollingNumber
        value={wholeNumber}
        textStyle={styles?.wholeText}
        spinningAnimationConfig={{duration: DURATION}}
      />
      <Text className={classNames?.decimalSeparator}>.</Text>
      <AnimatedRollingNumber
        value={decimalPart}
        formattedText={decimalPart.toString().padStart(decimalPlaces, "0")}
        textStyle={styles?.decimalText}
        spinningAnimationConfig={{duration: DURATION}}
      />
    </View>
  );
};

export default SavingCountUp;
