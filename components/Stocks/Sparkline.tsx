import React from 'react';
import Svg, { Path } from 'react-native-svg';

type SparklineProps = {
  trend: 'up' | 'down';
  width?: number;
  height?: number;
};

const UP_PATH =
  'M 0 20 C 8 18 12 17 18 14 C 24 11 28 14 34 11 C 40 8 50 7 60 3';
const DOWN_PATH =
  'M 0 4 C 8 6 12 8 18 10 C 24 12 28 9 34 13 C 40 16 50 17 60 21';

export default function Sparkline({ trend, width = 60, height = 24 }: SparklineProps) {
  const color = trend === 'up' ? '#94f27f' : '#ff5e5e';
  const pathD = trend === 'up' ? UP_PATH : DOWN_PATH;

  return (
    <Svg width={width} height={height} viewBox={`0 0 60 24`}>
      <Path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
