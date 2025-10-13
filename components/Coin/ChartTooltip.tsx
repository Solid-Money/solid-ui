import { Text } from '@/components/ui/text';
import { CoinPayload } from '@/lib/types';
import { useCoinStore } from '@/store/useCoinStore';
import { cn, formatNumber } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

interface TooltipPayload {
  payload: CoinPayload;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  data?: CoinPayload[];
}

export function calculatePercentageChange(oldValue: number, newValue: number) {
  if (oldValue === 0) {
    return null;
  }

  return ((newValue - oldValue) / oldValue) * 100;
}

const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const ChartTooltip = ({ active, payload, data }: ChartTooltipProps) => {
  const { selectedPrice, selectedPriceChange, setSelectedPriceChange, setSelectedPrice } =
    useCoinStore();
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const prevPayloadRef = useRef<any>(null);

  useEffect(() => {
    if (!active || !payload || payload.length < 1 || !data) {
      return;
    }

    const chartPayload = payload[0];
    const currentTimestamp = chartPayload.payload.time;
    const currentPrice = chartPayload.payload.value;

    if (
      prevPayloadRef.current?.payload?.time === currentTimestamp &&
      prevPayloadRef.current?.payload?.value === currentPrice
    ) {
      return;
    }

    prevPayloadRef.current = chartPayload;

    setCurrentTimestamp(currentTimestamp);
    setSelectedPrice(currentPrice);

    let previousPrice;
    for (let i = 1; i < data.length; i++) {
      if (data[i].time === currentTimestamp) {
        previousPrice = data[i - 1]?.value;
      }
    }

    if (previousPrice) {
      const priceChange = calculatePercentageChange(previousPrice, currentPrice);
      if (priceChange) {
        setSelectedPriceChange(priceChange);
      }
    }
  }, [active, payload, data, setSelectedPriceChange, setSelectedPrice]);

  if (!active || !payload || payload.length < 1) {
    return null;
  }

  return (
    <View className="p-3 bg-primary shadow-md rounded-xl">
      <View className="flex flex-col gap-1">
        <Text className="text-lg font-semibold text-primary-foreground">
          {selectedPrice ? `$${formatNumber(selectedPrice)}` : `$0.00`}
        </Text>
        <View className="flex text-sm gap-1">
          {selectedPriceChange && (
            <Text
              className={cn(
                'font-semibold',
                selectedPriceChange < 0 ? 'text-red-500' : 'text-brand',
              )}
            >
              {formatNumber(selectedPriceChange, 2)}%
            </Text>
          )}
          <Text className="text-muted-foreground">{formatTimestamp(currentTimestamp)}</Text>
        </View>
      </View>
    </View>
  );
};

export default ChartTooltip;
