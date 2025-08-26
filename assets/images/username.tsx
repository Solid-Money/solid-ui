import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgComponent = ({ color = '#FFFFFF', ...props }: SvgProps) => (
  <Svg width={43} height={44} fill="none" {...props}>
    <Path
      fill="#4D4D4D"
      d="M0 22.121C0 10.393 9.644.621 21.5.621s21.5 9.772 21.5 21.5-9.644 21.5-21.5 21.5S0 33.849 0 22.121Z"
    />
    <Path
      stroke={color}
      strokeWidth={1.5}
      d="M22 20.167a3.667 3.667 0 1 0 0-7.333 3.667 3.667 0 0 0 0 7.333ZM29.333 27.043c0 2.278 0 4.125-7.333 4.125s-7.333-1.847-7.333-4.125S17.95 22.918 22 22.918c4.05 0 7.333 1.847 7.333 4.125Z"
    />
  </Svg>
);

export default SvgComponent;
