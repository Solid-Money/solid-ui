import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/ui/text';

interface CircularProgressProps {
  /** Number of completed items */
  completed: number;
  /** Total number of items */
  total: number;
  size?: number;
  strokeWidth?: number;
}

/**
 * Small circular progress ring used on the home "Finish setting up" card.
 * Renders a neutral track with a brand-green arc proportional to completed/total
 * and a centered "{completed} / {total}" label.
 */
export default function CircularProgress({
  completed,
  total,
  size = 64,
  strokeWidth = 6,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const arcGapLength = circumference - arcLength;
  const progress = total > 0 ? Math.min(Math.max(completed / total, 0), 1) : 0;
  const progressLength = arcLength * progress;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={[arcLength, arcGapLength]}
          fill="none"
        />
        {progress > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#94F27F"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={[progressLength, circumference - progressLength]}
            fill="none"
          />
        )}
      </Svg>
      <Text className="text-base font-semibold text-foreground">
        {completed} <Text className="font-normal text-muted-foreground">/ {total}</Text>
      </Text>
    </View>
  );
}
