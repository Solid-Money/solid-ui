import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgComponent = (props: SvgProps) => (
  <Svg width={25} height={23} fill="none" viewBox="0 0 25 23" {...props}>
    <Path
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeOpacity={0.7}
      strokeWidth={1.5}
      d="M17.451 5.889h5.14c.709 0 1.284.575 1.284 1.285v14.132l-4.282-3.558a1.3 1.3 0 0 0-.822-.297H8.458c-.71 0-1.284-.575-1.284-1.284v-3.855M17.45 5.89V2.035c0-.71-.575-1.285-1.284-1.285H2.035C1.325.75.75 1.325.75 2.035v14.132l4.282-3.558c.23-.191.522-.296.822-.296h1.32M17.45 5.889v5.139c0 .71-.575 1.284-1.284 1.284H7.174"
    />
  </Svg>
);

export default SvgComponent;
