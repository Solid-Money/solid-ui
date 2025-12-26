import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgComponent = ({ color = '#FFFFFF', width = 21, height = 21, ...props }: SvgProps & { rotate?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 21 21" fill="none" style={{ transform: [{ rotate: `${props.rotate || 0}deg` }] }} {...props}>
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M15.54 3.293H5.46a3.36 3.36 0 0 0-3.36 3.36v8.4a3.36 3.36 0 0 0 3.36 3.36h10.08a3.36 3.36 0 0 0 3.36-3.36v-8.4a3.36 3.36 0 0 0-3.36-3.36Z"
    />
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M2.1 8.375h2.83a2.52 2.52 0 0 1 0 5.04H2.1"
    />
  </Svg>
);

export default SvgComponent;
