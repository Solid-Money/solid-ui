import { Text } from '@/components/ui/text';
import { ChartPayload } from '@/lib/types';
import { useCoinStore } from '@/store/useCoinStore';
import { cn, formatNumber } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

interface TooltipPayload {
  payload: ChartPayload;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  data?: ChartPayload[];
  formatToolTip?: (value: number | null) => string;
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

const ChartTooltip = ({ active, payload, data, formatToolTip }: ChartTooltipProps) => {
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

  const format = (value: number | null) => {
    if (!value) {
      return `$0.00`;
    }
    return `$${formatNumber(value)}`;
  };

  return (
    <View className="p-3 bg-primary shadow-md rounded-xl">
      <View className="gap-1">
        <Text className="text-lg font-semibold text-primary-foreground">
          {formatToolTip ? formatToolTip(selectedPrice) : format(selectedPrice)}
        </Text>
        <View className="flex-row gap-2">
          {selectedPriceChange && (
            <Text
              className={cn(
                'text-sm font-semibold',
                selectedPriceChange < 0 ? 'text-red-500' : 'text-green-500',
              )}
            >
              {formatNumber(selectedPriceChange, 2)}%
            </Text>
          )}
          <Text className="text-sm text-muted-foreground">{formatTimestamp(currentTimestamp)}</Text>
        </View>
      </View>
    </View>
  );
};

export default ChartTooltip;
