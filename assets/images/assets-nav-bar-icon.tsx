import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgComponent = ({ color = '#9A9A9A', ...props }: SvgProps) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
    <Path fill={color == '#8E8E8F' ? 'transparent' : color} d="M20.3678 9.6747L13.278 3.6465C12.5297 3.01032 11.4303 3.01155 10.6835 3.6494L3.62881 9.67488C3.18393 10.0549 2.92773 10.6106 2.92773 11.1957V19.4575C2.92773 20.562 3.82316 21.4575 4.92773 21.4575H8.96989V16.7959C8.96989 15.6913 9.86532 14.7959 10.9699 14.7959H13.0428C14.1473 14.7959 15.0428 15.6913 15.0428 16.7959V21.4575H19.0723C20.1769 21.4575 21.0723 20.562 21.0723 19.4575V11.1984C21.0723 10.6117 20.8147 10.0547 20.3678 9.6747Z" stroke={color == '#ffffff' ? '#9A9A9A' : color} strokeWidth={2} />
  </Svg>
);

export default SvgComponent;
