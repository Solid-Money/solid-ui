import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';
const SvgComponent = (props: SvgProps) => (
  <Svg width={14} height={15} fill="none" {...props}>
    <Path
      stroke="#fff"
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M13.258 1.408H2.192m11.066 0V12.33m0-10.922L1.089 13.577"
    />
  </Svg>
);
export default SvgComponent;
