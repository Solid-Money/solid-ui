import * as React from "react";
import Svg, { G, Path, Defs, ClipPath, SvgProps } from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 20 20"
    fill="none"
    {...props}
  >
    <G clipPath="url(#a)" stroke="#fff" strokeWidth={1.5}>
      <Path d="M10.001 18.333a8.333 8.333 0 1 0 0-16.666 8.333 8.333 0 0 0 0 16.666Z" />
      <Path d="M10.001 13.333a3.333 3.333 0 1 0 0-6.666 3.333 3.333 0 0 0 0 6.666ZM12.5 7.5l3.333-3.333M4.168 15.833 7.501 12.5m0-5L4.168 4.167m11.665 11.666L12.5 12.5" />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" d="M0 0h20v20H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SVGComponent;
