import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgComponent = ({ color = '#FFFFFF', ...props }: SvgProps) => (
  <Svg width={50} height={50} fill="none" {...props}>
    <Path
      fill="#4D4D4D"
      d="M0 25C0 11.193 11.193 0 25 0s25 11.193 25 25-11.193 25-25 25S0 38.807 0 25Z"
    />
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m21.375 35.876 2.086-3.336a9.667 9.667 0 0 0 1.28-3.228l.072-.351c.125-.625.187-1.26.187-1.897v-2.063m-10.875 4.23c.604-1.21 1.208-2.47 1.208-4.23 0-2.102.672-4.05 1.813-5.637m0 13.491c2.416-2.416 3.02-6.328 3.02-7.854a4.833 4.833 0 0 1 9.612-.737m4.285 7.383c.604-2.417.604-4.834.604-6.646a9.667 9.667 0 0 0-14.5-8.374m9.61 11.999c-.21 1.683-.804 3.844-2.36 6.646"
    />
  </Svg>
);

export default SvgComponent;
