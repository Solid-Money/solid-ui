import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgComponent = (props: SvgProps) => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="none" {...props}>
    <Path
      d="M9.63086 1L9.63086 18.2597"
      stroke={props.stroke || 'black'}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M18.2598 9.62891L1.00002 9.62891"
      stroke={props.stroke || 'black'}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export default SvgComponent;

