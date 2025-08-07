import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgComponent = ({ color = '#9A9A9A', ...props }: SvgProps) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width={22} height={16} fill="none" {...props}>
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeWidth={4}
      d="M2.889 2.03h10.899M19.236 2.03h.028M2.889 7.995h10.899M19.236 7.995h.028M2.889 13.969h10.899M19.236 13.969h.028"
    />
  </Svg>
);

export default SvgComponent;
