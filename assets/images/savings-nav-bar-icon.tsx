import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgComponent = ({ color = '#9A9A9A', ...props }: SvgProps) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
    <Path d="M14.5847 3.06128H9.22723C9.06016 3.06128 8.97663 3.06128 8.90289 3.08672C8.83767 3.10921 8.77827 3.14592 8.72898 3.19419C8.67325 3.24878 8.6359 3.3235 8.56118 3.47292L4.65168 11.2919C4.47326 11.6488 4.38405 11.8272 4.40548 11.9722C4.42419 12.0988 4.49424 12.2122 4.59915 12.2856C4.71929 12.3696 4.91877 12.3696 5.31773 12.3696H11.0941L8.30159 21.6779L19.6513 9.90785C20.0343 9.51075 20.2257 9.3122 20.2369 9.1423C20.2466 8.99484 20.1857 8.85152 20.0728 8.75615C19.9428 8.64628 19.6669 8.64628 19.1152 8.64628H12.4903L14.5847 3.06128Z" fill={color == '#8E8E8F' ? 'transparent' : color} stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </Svg>
);

export default SvgComponent;
