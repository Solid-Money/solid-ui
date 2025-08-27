import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgComponent = ({ color = '#FFFFFF', ...props }: SvgProps) => (
  <Svg width={43} height={43} fill="none" {...props}>
    <Path
      fill="#4D4D4D"
      d="M0 21.494C0 9.766 9.644-.006 21.5-.006s21.5 9.772 21.5 21.5-9.644 21.5-21.5 21.5S0 33.222 0 21.494Z"
    />
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M26.54 14.293H16.46a3.36 3.36 0 0 0-3.36 3.36v8.4a3.36 3.36 0 0 0 3.36 3.36h10.08a3.36 3.36 0 0 0 3.36-3.36v-8.4a3.36 3.36 0 0 0-3.36-3.36Z"
    />
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M13.1 19.375h2.83a2.52 2.52 0 0 1 0 5.04H13.1"
    />
  </Svg>
);

export default SvgComponent;
