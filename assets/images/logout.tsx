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
      strokeWidth={1.5}
      d="M20.502 20c.012-2.175.108-3.353.877-4.121.879-.879 2.293-.879 5.121-.879h1c2.829 0 4.243 0 5.121.879.88.878.88 2.293.88 5.121v8c0 2.828 0 4.243-.88 5.121-.878.879-2.292.879-5.12.879h-1c-2.83 0-4.243 0-5.122-.879-.769-.768-.865-1.946-.877-4.121"
    />
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M26.5 25h-13m0 0 3.5-3m-3.5 3 3.5 3"
    />
  </Svg>
);

export default SvgComponent;
