import * as React from "react";
import Svg, { G, Path, Defs, ClipPath, SvgProps } from "react-native-svg";
const SVGComponent = ({ color = '#FFFFFF', ...props }: SvgProps) => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 18 18"
    fill="none"
    {...props}
  >
    <G clipPath="url(#a)">
      <Path
        d="M12.564 4.96h3.7c.511 0 .925.414.925.925V16.06l-3.083-2.562a.94.94 0 0 0-.592-.213H6.09a.924.924 0 0 1-.925-.925V9.584m0 0-.95.001a.93.93 0 0 0-.592.213L.54 12.36V2.185c0-.511.414-.925.925-.925H11.64c.51 0 .924.414.924.925V8.66a.924.924 0 0 1-.924.924z"
        stroke={color}
        strokeOpacity={0.7}
        strokeWidth={1.08}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill={color} d="M0 0h18v18H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SVGComponent;
