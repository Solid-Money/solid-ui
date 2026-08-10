import * as React from 'react';
import Svg, { G, Path, SvgProps } from 'react-native-svg';

/** Stacked-notes glyph used by the "Move from wallet or savings" fund option. */
const SvgComponent = ({ color = '#FFFFFF', width = 22, height = 25, ...props }: SvgProps) => (
  <Svg width={width} height={height} viewBox="0 0 22.097 25.0738" fill="none" {...props}>
    <Path
      d="M17.294 11.8742C18.8911 11.1891 20.7138 11.9956 21.3653 13.6755C22.0167 15.3555 21.25 17.273 19.6528 17.9582L4.8033 24.3288C3.20612 25.014 1.38317 24.2075 0.731709 22.5275C0.0802757 20.8475 0.847008 18.9301 2.4442 18.2449L17.294 11.8742ZM17.294 0.744907C18.8911 0.0597916 20.7138 0.866241 21.3653 2.54618C22.0167 4.22619 21.25 6.14365 19.6528 6.82886L4.8033 13.1995C3.20612 13.8847 1.38317 13.0782 0.731709 11.3982C0.0802757 9.71823 0.847008 7.80078 2.4442 7.11556L17.294 0.744907Z"
      stroke={color}
      strokeLinecap="round"
    />
    <G transform="translate(12.5 9.24)">
      <Path
        d="M7.03947 2.6333L6.88697 2.57935L0.500135 0.500135"
        stroke={color}
        strokeLinecap="round"
      />
    </G>
    <G transform="translate(2.31 12.8)">
      <Path d="M6.69301 2.51632L0.500135 0.500135" stroke={color} strokeLinecap="round" />
    </G>
  </Svg>
);

export default SvgComponent;
