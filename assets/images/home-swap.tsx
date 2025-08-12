import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';
const SvgComponent = (props: SvgProps) => (
  <Svg width={29} height={28} fill="none" {...props}>
    <Path
      stroke="#fff"
      strokeLinecap="round"
      strokeWidth={2}
      d="M5.564 8.637c2.732-4.734 8.785-6.355 13.518-3.623 3.749 2.165 5.546 6.412 4.773 10.436m0 0 3.462-3.86m-3.462 3.86-4.258-3.701M23.042 18.473c-2.733 4.733-8.785 6.355-13.518 3.622a9.9 9.9 0 0 1-4.773-10.436m0 0-3.462 3.86m3.462-3.86 4.258 3.701"
    />
  </Svg>
);
export default SvgComponent;
