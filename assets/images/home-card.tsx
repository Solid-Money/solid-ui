import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgComponent = (props: SvgProps) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width={25} height={21} fill="none" {...props}>
    <Path
      stroke="#fff"
      strokeWidth={2}
      d="M1.213 10.066c0-4.256 0-6.384 1.323-7.707 1.322-1.322 3.45-1.322 7.707-1.322h4.514c4.257 0 6.385 0 7.707 1.322 1.323 1.323 1.323 3.451 1.323 7.707 0 4.257 0 6.385-1.323 7.707-1.322 1.323-3.45 1.323-7.707 1.323h-4.514c-4.257 0-6.385 0-7.707-1.323-1.323-1.322-1.323-3.45-1.323-7.707Z"
    />
    <Path
      stroke="#fff"
      strokeLinecap="round"
      strokeWidth={2}
      d="M11.793 14.581H5.728M1.213 7.81h22.574"
    />
  </Svg>
);
export default SvgComponent;
