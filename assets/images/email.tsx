import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgComponent = ({ color = '#FFFFFF', ...props }: SvgProps) => (
  <Svg width={43} height={44} fill="none" {...props}>
    <Path
      fill="#4D4D4D"
      d="M0 22.309C0 10.581 9.644.809 21.5.809s21.5 9.772 21.5 21.5-9.644 21.5-21.5 21.5S0 34.037 0 22.309Z"
    />
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m14 19 6.2 4.65a3 3 0 0 0 3.6 0L30 19"
    />
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M13 19.176a2 2 0 0 1 1.029-1.748l7-3.89a2 2 0 0 1 1.942 0l7 3.89A2 2 0 0 1 31 19.176v7.823a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2v-7.823Z"
    />
  </Svg>
);

export default SvgComponent;
