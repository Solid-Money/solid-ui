import * as React from 'react';
import Svg, { Path, G, Rect, SvgProps } from 'react-native-svg';

const GbpFlag = (props: SvgProps) => (
  <Svg width={21} height={15} viewBox="0 0 21 15" fill="none" {...props}>
    <Rect width={21} height={15} fill="#012169" />
    <Path d="M0 0L21 15M21 0L0 15" stroke="white" strokeWidth="3.3" />
    <Path d="M0 0L21 15M21 0L0 15" stroke="#C8102E" strokeWidth="2.2" />
    <Path d="M10.5 0V15M0 7.5H21" stroke="white" strokeWidth="5" />
    <Path d="M10.5 0V15M0 7.5H21" stroke="#C8102E" strokeWidth="3" />
  </Svg>
);

export default GbpFlag;
