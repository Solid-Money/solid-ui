import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatNumber } from '@/lib/utils';

type SliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
};

export function BorrowSlider({ value, onValueChange, min, max }: SliderProps) {
  const [sliderWidth, setSliderWidth] = useState(0);
  const [inputValue, setInputValue] = useState(value.toString());
  const sliderContainerRef = useRef<View>(null);
  const sliderPageX = useRef(0);
  const isDragging = useRef(false);
  const STEP_SIZE = useMemo(() => (max < 1 ? 0.01 : 1), [max]);

  const [isDraggingState, setIsDraggingState] = useState(false);

  // Sync input value with prop value when not dragging
  useEffect(() => {
    if (!isDragging.current) {
      setInputValue(value.toString());
    }
  }, [value]);

  // Calculate decimal places from step size
  const decimalPlaces = useMemo(() => {
    if (STEP_SIZE >= 1) return 0;
    const stepStr = STEP_SIZE.toString();
    if (stepStr.includes('.')) {
      return stepStr.split('.')[1].length;
    }
    return 0;
  }, [STEP_SIZE]);

  // Ensure value is valid number
  const safeValue = useMemo(() => {
    const numValue = Number(value);
    if (isNaN(numValue) || !isFinite(numValue)) return min;
    return Math.max(min, Math.min(max, numValue));
  }, [value, min, max]);

  const safeMax = useMemo(() => {
    const numMax = Number(max);
    if (isNaN(numMax) || !isFinite(numMax)) return min;
    const clamped = Math.max(min, numMax);
    // Round to nearest step size
    return Math.round(clamped / STEP_SIZE) * STEP_SIZE;
  }, [max, min, STEP_SIZE]);

  const range = safeMax - min;
  const percentage = range > 0 ? ((safeValue - min) / range) * 100 : 0;
  const thumbPosition = (percentage / 100) * sliderWidth;

  const stateRef = useRef({ sliderWidth, min, safeMax, onValueChange, thumbPosition, range });
  stateRef.current = { sliderWidth, min, safeMax, onValueChange, thumbPosition, range };

  const updateValue = (newValue: number) => {
    const numValue = Number(newValue);
    if (isNaN(numValue) || !isFinite(numValue)) return;
    const clampedValue = Math.max(min, Math.min(safeMax, numValue));
    // Round to nearest 0.1 (0.1 unit steps)
    onValueChange(Math.round(clampedValue / STEP_SIZE) * STEP_SIZE);
  };

  const handleInputChange = (text: string) => {
    // Remove the dollar sign if it's there
    const cleanText = text.replace('$', '');
    // Only allow numbers and decimal point
    const sanitized = cleanText.replace(/[^0-9.]/g, '');
    setInputValue(sanitized);

    const numValue = parseFloat(sanitized);
    if (!isNaN(numValue)) {
      updateValue(numValue);
    }
  };

  const handleInputBlur = () => {
    // On blur, ensure the input matches the formatted safe value
    setInputValue(safeValue.toString());
  };

  const displayValue = useMemo(() => {
    if (isDraggingState) {
      return `$${formatNumber(safeValue, decimalPlaces, decimalPlaces)}`;
    }
    return `$${inputValue}`;
  }, [isDraggingState, safeValue, decimalPlaces, inputValue]);

  const handleTrackPress = (event: any) => {
    if (sliderWidth === 0 || range <= 0) return;
    const { locationX } = event.nativeEvent;
    const newPercentage = Math.max(0, Math.min(100, (locationX / sliderWidth) * 100));
    const newValue = min + (newPercentage / 100) * range;
    updateValue(newValue);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        isDragging.current = true;
        setIsDraggingState(true);
        const thumbPageX = evt.nativeEvent.pageX;
        if (sliderContainerRef.current) {
          sliderContainerRef.current.measure((_x, _y, _width, _height, pageX) => {
            sliderPageX.current = pageX;
          });
        }
        // Use current thumb position as fallback
        const { thumbPosition } = stateRef.current;
        if (sliderPageX.current === 0) {
          // Estimate based on thumb position
          sliderPageX.current = thumbPageX - thumbPosition;
        }
      },
      onPanResponderMove: evt => {
        const { sliderWidth, min, safeMax, onValueChange, thumbPosition } = stateRef.current;

        if (sliderWidth === 0 || !isDragging.current) return;
        const currentRange = safeMax - min;
        if (currentRange <= 0) return;

        const currentPageX = evt.nativeEvent.pageX;
        // If pageX wasn't set, use the initial touch position
        if (sliderPageX.current === 0) {
          sliderPageX.current = currentPageX - thumbPosition;
        }
        const relativeX = currentPageX - sliderPageX.current;
        const newPercentage = Math.max(0, Math.min(100, (relativeX / sliderWidth) * 100));
        const newValue = min + (newPercentage / 100) * currentRange;

        // updateValue logic inline using ref values
        const numValue = Number(newValue);
        if (isNaN(numValue) || !isFinite(numValue)) return;
        const clampedValue = Math.max(min, Math.min(safeMax, numValue));
        // Round to nearest 0.1 (0.1 unit steps)
        onValueChange(Math.round(clampedValue / STEP_SIZE) * STEP_SIZE);
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
        setIsDraggingState(false);
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        setIsDraggingState(false);
      },
    }),
  ).current;

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="mt-5 text-center text-base font-medium opacity-50">Amount to borrow</Text>
        <View className="flex-row items-center justify-center">
          <TextInput
            value={displayValue}
            onChangeText={handleInputChange}
            onBlur={handleInputBlur}
            keyboardType="decimal-pad"
            className="text-3xl font-semibold text-white"
            style={{
              padding: 0,
              minWidth: 40,
              textAlign: 'center',
            }}
          />
        </View>
      </View>
      <View>
        <View
          ref={sliderContainerRef}
          onLayout={event => {
            const width = event.nativeEvent.layout.width;
            if (width > 0 && sliderWidth !== width) {
              setSliderWidth(width);
            }
          }}
          className="relative w-full"
        >
          <Pressable
            onPress={handleTrackPress}
            className="relative h-8 w-full justify-center"
            style={{ zIndex: 1 }}
          >
            <View className="absolute h-2 w-full rounded-full bg-accent" />
            <View
              className="absolute h-2 rounded-full bg-brand"
              style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
            />
          </Pressable>
          <View
            {...panResponder.panHandlers}
            className="absolute h-6 w-6 rounded-full bg-brand shadow-lg"
            style={{
              transform: [
                { translateX: Math.max(0, Math.min(sliderWidth - 24, thumbPosition - 12)) },
              ],
              top: 3,
              zIndex: 10,
            }}
          />
        </View>
        <View className="mt-2 w-full flex-row justify-between">
          <Text className="text-sm text-muted-foreground">
            ${formatNumber(min, decimalPlaces, decimalPlaces)}
          </Text>
          <Text className="text-sm text-muted-foreground">
            ${formatNumber(safeMax, decimalPlaces, decimalPlaces)}
          </Text>
        </View>
      </View>
    </View>
  );
}
