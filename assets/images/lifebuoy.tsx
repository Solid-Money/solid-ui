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
      strokeWidth={1.5}
      d="M25 37.5c6.904 0 12.5-5.596 12.5-12.5 0-6.903-5.596-12.5-12.5-12.5s-12.5 5.597-12.5 12.5c0 6.904 5.596 12.5 12.5 12.5Z"
    />
    <Path
      stroke={color}
      strokeWidth={1.5}
      d="M25 30a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM28.75 21.25l5-5M16.25 33.75l5-5M21.25 21.25l-5-5M33.75 33.75l-5-5"
    />
  </Svg>
);

export default SvgComponent;
