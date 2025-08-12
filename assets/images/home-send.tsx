import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';
const SvgComponent = (props: SvgProps) => (
  <Svg width={25} height={24} fill="none" {...props}>
    <Path
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.524 12 1.3 21.673c-.282.845.6 1.61 1.396 1.21l19.978-9.989a1 1 0 0 0 0-1.788L2.696 1.116C1.899.718 1.018 1.482 1.3 2.327L4.524 12Zm0 0H12.5"
    />
  </Svg>
);
export default SvgComponent;
