import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { Text } from '@/components/ui/text';
import { ChartPayload } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { formatChartTooltipDate } from '@/lib/utils/chartDate';
import { useCoinStore } from '@/store/useCoinStore';

interface TooltipPayload {
  payload: ChartPayload;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  data?: ChartPayload[];
  formatToolTip?: (value: number | null) => string;
  compact?: boolean;
}

export function calculatePercentageChange(oldValue: number, newValue: number) {
  if (oldValue === 0) {
    return null;
  }

  return ((newValue - oldValue) / oldValue) * 100;
}

const ChartTooltip = ({
  active,
  payload,
  data,
  formatToolTip,
  compact = false,
}: ChartTooltipProps) => {
  const { selectedPrice, setSelectedPriceChange, setSelectedPrice } = useCoinStore(
    useShallow(state => ({
      selectedPrice: state.selectedPrice,
      setSelectedPriceChange: state.setSelectedPriceChange,
      setSelectedPrice: state.setSelectedPrice,
    })),
  );
  const [currentTimestamp, setCurrentTimestamp] = useState<number | string>(0);
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
      if (String(data[i].time) === String(currentTimestamp)) {
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
    <View
      className={
        compact
          ? 'rounded-lg bg-primary px-2 py-1.5 shadow-md'
          : 'rounded-xl bg-primary p-3 shadow-md'
      }
    >
      <View className={compact ? 'gap-0.5' : 'gap-1'}>
        <Text
          className={
            compact
              ? 'text-[13px] font-semibold leading-[15px] text-primary-foreground'
              : 'text-lg font-semibold text-primary-foreground'
          }
        >
          {formatToolTip ? formatToolTip(selectedPrice) : format(selectedPrice)}
        </Text>
        <Text
          className={
            compact
              ? 'text-[10px] leading-3 text-muted-foreground'
              : 'text-sm text-muted-foreground'
          }
        >
          {formatChartTooltipDate(currentTimestamp)}
        </Text>
      </View>
    </View>
  );
};

export default ChartTooltip;
