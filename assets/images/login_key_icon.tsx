import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

interface LoginKeyIconProps extends SvgProps {
  color?: string;
}

const SvgComponent = ({ width = 24, height = 12, color = '#fff', ...props }: LoginKeyIconProps) => (
  <Svg width={width} height={height} fill="none" viewBox="0 0 24 12" {...props}>
    <Path fill={color} fillRule="evenodd" d="M5.923 0a5.926 5.926 0 0 1 5.703 4.315h10.511c.748 0 1.354.606 1.354 1.354v4.982h-2.094v-1.47s.07-.788-1.023-.788c-1.094 0-1.094.788-1.094.788v1.47h-2.094V7.428h-5.532A5.923 5.923 0 1 1 5.924 0M3.146 5.923a2.789 2.789 0 1 1 5.577 0 2.789 2.789 0 0 1-5.577 0" clipRule="evenodd" />
  </Svg>
);

export default SvgComponent;
